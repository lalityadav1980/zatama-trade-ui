import platform
import subprocess
import sys
from pathlib import Path
from threading import Thread
from typing import List, Dict

import pytz  # Make sure to install pytz if it's not available
from dateutil.parser import parser
from flask import Blueprint, jsonify, current_app, request
from kiteconnect import KiteConnect

from config import get_user_kite_instance
from ml_trade_final import MODEL_15_MINUTE_PATH, SCALER_15_MINUTE_PATH, \
    FEATURE_COLS_15_MINUTE_PATH, CALIBRATED_15_MINUTE_PATH, MODEL_30_MINUTE_PATH, SCALER_30_MINUTE_PATH, \
    FEATURE_COLS_30_MINUTE_PATH, CALIBRATED_30_MINUTE_PATH, MODEL_HOUR_PATH, SCALER_HOUR_PATH, FEATURE_COLS_HOUR_PATH, \
    CALIBRATED_HOUR_PATH
from order_service_api import fetch_all_positions, thread_wrapper, start_trailing_thread
from place_order import place_order_service, get_today_trade_action
from util import fetch_order_tracker, \
    load_resources, process_15_min_data, process_30_min_data, \
    process_hour_data, calculate_profit, \
    generate_signals, \
    merge_all_timeframes, analyze_multi_timeframe_sideways, \
    select_trade_signal_data, insert_trade_signal_data, \
    fetch_single_order_by_zerodha_id, \
    load_trailing_stop_loss_parameters, \
    update_trailing_stop_loss_parameters, get_userid_by_email, insert_wide_bars, \
    delete_all_wide_bars, insert_wide_bars_snapshot, \
    fetch_latest_weighted_signals, fetch_wide_bars_between_snapshot, fetch_all_wide_bars_snapshot

import os
import pandas as pd
import time  # ✅ Built-in time module for sleep
from collections import deque
from order_cache import set_order_cache

from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import List, Dict
import logging
from datetime import datetime, date, timedelta
from typing import Tuple, Union
from dateutil import parser as dtparser
logger = logging.getLogger("process_data")          # <── unique name for the entry-point module
logger.setLevel(logging.DEBUG)             # capture everything internally
logger.propagate = False                   # don’t bubble up to the root

# Create ~/logs if it doesn’t exist
home_dir = Path(os.getenv("HOME", Path.cwd()))
log_dir = home_dir / "logs"
log_dir.mkdir(parents=True, exist_ok=True)

# Rotating file handler — max 5 MB, keep 1 backup
rotating_handler = RotatingFileHandler(
    filename=log_dir / "process_data.log",          # <── separate file for the entry point
    maxBytes=5 * 1024 * 1024,
    backupCount=0,
)
rotating_handler.setLevel(logging.WARNING)  # only WARNING+ go to disk
rotating_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] [%(threadName)s] %(message)s"
))
logger.addHandler(rotating_handler)

# Console handler — INFO+ to stdout
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s"
))
logger.addHandler(console_handler)

logger.info("process_data logger initialized: file captures WARNING+ only")

# Ensure all columns are visible
pd.set_option("display.max_columns", None)  # Show all columns
pd.set_option("display.expand_frame_repr", False)  # Prevent truncation

# Define the IST timezone.
ist = pytz.timezone('Asia/Kolkata')
IST = pytz.timezone("Asia/Kolkata")

MODEL_PATH = 'data/output/models/best_model_new.pkl'
SCALER_PATH = 'data/output/models/scaler.pkl'
FEATURE_COLS_PATH = 'data/output/models/feature_cols.pkl'
CALIBRATED_PATH = 'data/output/models/calibrated_preds_rel.pkl'
signal_bp = Blueprint('signal', __name__)




@signal_bp.route('/restart-zatamap', methods=['POST'])
def restart_zatamap():
    def async_restart():
        try:
            subprocess.run(
                ['/usr/bin/sudo', 'systemctl', 'restart', 'zatamap.service'],
                check=True,
                env={'PATH': '/usr/bin:/bin'}
            )
        except Exception as e:
            current_app.logger.error(f"Async restart failed: {str(e)}")

    # Start restart in a background thread
    Thread(target=async_restart).start()

    return jsonify({
        'status': 'success',
        'message': 'Service restart initiated'
    }), 202


# ------------------------------------------------------------------
# Fri → Thu expiry week helpers
# ------------------------------------------------------------------
def _expiry_thursday_fri_to_thu(dt: Union[datetime, date]) -> date:
    """
    Map any datetime/date to the EXPIRY THURSDAY of the *Fri→Thu* week.
    Fri/Sat/Sun are considered part of the NEXT Thursday's expiry week.
    Mon–Thu belong to the current Thursday.
    """
    if isinstance(dt, datetime):
        dt = dt.date()

    wd = dt.weekday()  # Mon=0 ... Sun=6
    if wd <= 3:  # Mon..Thu  -> same week's Thu
        return dt + timedelta(days=(3 - wd))
    else:        # Fri(4)..Sun(6) -> next week's Thu
        return dt + timedelta(days=(10 - wd))  # 4->+6, 5->+5, 6->+4


def _week_bounds_from_expiry_fri_to_thu(expiry_thu: Union[datetime, date]) -> Tuple[date, date]:
    """
    Given an expiry Thursday, return the Fri→Thu (5 trading-day) window:
    start_date = previous Friday, end_date = that Thursday.
    """
    if isinstance(expiry_thu, datetime):
        expiry_thu = expiry_thu.date()

    start = expiry_thu - timedelta(days=6)  # previous Friday
    end = expiry_thu                        # expiry Thursday
    return start, end


# ------------------------------------------------------------------
# 1) /api/trade-signals  → DATA ONLY (wide‑bar table)
# ------------------------------------------------------------------
@signal_bp.route("/api/trade-signals", methods=["GET"])
def get_trade_signals():
    # 0️⃣  Pull from Postgres
    df = fetch_all_wide_bars_snapshot()
    if df is None:
        return jsonify({"error": "Failed to fetch data"}), 500
    if df.empty:
        return jsonify({"data": []})

    # 1️⃣  Columns you actually want to expose
    BASE_COLS = [
        "date",
        # ── stock‑level OHLCV + micro‑signal
        "reliance_open", "reliance_high", "reliance_low", "reliance_close",
        "reliance_volume", "reliance_signal",
        "hdfcbank_open", "hdfcbank_high", "hdfcbank_low", "hdfcbank_close",
        "hdfcbank_volume", "hdfcbank_signal",
        "bhartiartl_open", "bhartiartl_high", "bhartiartl_low",
        "bhartiartl_close", "bhartiartl_volume", "bhartiartl_signal",
        "tcs_open", "tcs_high", "tcs_low", "tcs_close", "tcs_volume", "tcs_signal",
        "icicibank_open", "icicibank_high", "icicibank_low", "icicibank_close",
        "icicibank_volume", "icicibank_signal",
        "sbin_open", "sbin_high", "sbin_low", "sbin_close",
        "sbin_volume", "sbin_signal",
        "infy_open", "infy_high", "infy_low", "infy_close",
        "infy_volume", "infy_signal",
        "bajfinance_open", "bajfinance_high", "bajfinance_low",
        "bajfinance_close", "bajfinance_volume", "bajfinance_signal",
        "hindunilvr_open", "hindunilvr_high", "hindunilvr_low",
        "hindunilvr_close", "hindunilvr_volume", "hindunilvr_signal",
        "itc_open", "itc_high", "itc_low", "itc_close",
        "itc_volume", "itc_signal",
        # ── NIFTY 50 raw bars
        "current_open", "current_high", "current_low", "current_close",
        "current_volume",
        # ── market‑level decision & P/L
        "weighted_signal",
        "Final_Signal",        # if produced downstream
        "Priority_Trigger",    # idem
        "gained_points",
    ]

    # 2️⃣  Keep only columns that exist in the DataFrame (robust to schema drift)
    cols_in_db   = set(df.columns)
    desired_cols = [c for c in BASE_COLS if c in cols_in_db]

    if not desired_cols:                               # safeguard
        desired_cols = list(df.columns)

    # 3️⃣  Convert to list‑of‑dicts for JSON
    payload = (
        df[desired_cols]
        .sort_values("date")            # chronological order
        .to_dict(orient="records")
    )

    return jsonify({"data": payload})


# ---------------------------------------------
# column list reused from previous endpoint
# ---------------------------------------------
BASE_COLS = [
    "date",
    "reliance_open", "reliance_high", "reliance_low", "reliance_close",
    "reliance_volume", "reliance_signal",
    "hdfcbank_open", "hdfcbank_high", "hdfcbank_low", "hdfcbank_close",
    "hdfcbank_volume", "hdfcbank_signal",
    "bhartiartl_open", "bhartiartl_high", "bhartiartl_low",
    "bhartiartl_close", "bhartiartl_volume", "bhartiartl_signal",
    "tcs_open", "tcs_high", "tcs_low", "tcs_close", "tcs_volume", "tcs_signal",
    "icicibank_open", "icicibank_high", "icicibank_low", "icicibank_close",
    "icicibank_volume", "icicibank_signal",
    "sbin_open", "sbin_high", "sbin_low", "sbin_close",
    "sbin_volume", "sbin_signal",
    "infy_open", "infy_high", "infy_low", "infy_close",
    "infy_volume", "infy_signal",
    "bajfinance_open", "bajfinance_high", "bajfinance_low",
    "bajfinance_close", "bajfinance_volume", "bajfinance_signal",
    "hindunilvr_open", "hindunilvr_high", "hindunilvr_low",
    "hindunilvr_close", "hindunilvr_volume", "hindunilvr_signal",
    "itc_open", "itc_high", "itc_low", "itc_close",
    "itc_volume", "itc_signal",
    "current_open", "current_high", "current_low", "current_close",
    "current_volume",
    "weighted_signal",
    "Final_Signal", "Priority_Trigger", "gained_points",
]


def _parse_ist(ts: str) -> datetime:
    """
    Parse ISO date/datetime string. If no tzinfo given, localise to IST.
    Raises ValueError on failure.
    """
    from datetime import datetime
    from dateutil import parser
    dt = parser.isoparse(ts)
    if dt.tzinfo is None:
        dt = IST.localize(dt)
    return dt


def _parse_ist_new(s: str, is_end: bool = False) -> datetime:
    """
    Accepts either YYYY‑MM‑DD or full ISO‑8601 datetime.
      • If only a date is given, returns
          start → 00:00:00.000000  IST   (as_end=False)
          end   → 23:59:59.999999 IST   (as_end=True)
    """
    dt = dtparser.parse(s)          # ← uses the un‑shadowed alias
    if dt.tzinfo is None:           # date or naïve dt → assume IST
        dt = IST.localize(dt)

    # date‑only input? expand to full day
    if len(s) == 10:                # "YYYY‑MM‑DD"
        if is_end:
            dt = dt + timedelta(days=1) - timedelta(microseconds=1)
            # 23:59:59.999999
        # else leave at midnight
    return dt


# ------------------------------------------------------------------
# 2) /api/trade‑signals/range?start=...&end=...
# ------------------------------------------------------------------
@signal_bp.route("/trade-signals/range", methods=["GET"])
def get_trade_signals_in_range():
    start_str = request.args.get("start")
    end_str   = request.args.get("end")

    if not start_str or not end_str:
        return jsonify({"error": "'start' and 'end' query params are required"}), 400

    try:
        start_dt = _parse_ist_new(start_str, is_end=False)
        end_dt   = _parse_ist_new(end_str,   is_end=True)
    except ValueError:
        return jsonify({"error": "Invalid datetime format; use ISO‑8601"}), 400

    if end_dt < start_dt:
        return jsonify({"error": "'end' must be after 'start'"}), 400

    # --- fetch from Postgres ---
    df = fetch_wide_bars_between_snapshot(start_dt, end_dt)
    if df is None:
        return jsonify({"error": "Failed to fetch data"}), 500
    if df.empty:
        return jsonify({"data": []})

    # --- filter to desired columns ---
    cols_in_db   = set(df.columns)
    desired_cols = [c for c in BASE_COLS if c in cols_in_db] or list(df.columns)

    payload = (
        df[desired_cols]
        .sort_values("date")
        .to_dict(orient="records")
    )
    return jsonify({"data": payload})


# ------------------------------------------------------------------
# Shared: normalize raw DB payload → list[dict] with a UTC‑naive ISO datetime string
# ------------------------------------------------------------------
def _normalize_rows(raw: List[Dict], desired_columns: List[str]) -> List[Dict]:
    out: List[Dict] = []
    for row in raw:
        item = {k: row.get(k) for k in desired_columns if k in row}

        date_val = item.get("date")
        if isinstance(date_val, str):
            date_val = dtparser.parse(date_val)

        if date_val.tzinfo:
            date_utc_naive = date_val.astimezone(pytz.utc).replace(tzinfo=None)
        else:
            date_utc_naive = date_val

        item["date"] = date_utc_naive.strftime("%Y-%m-%d %H:%M:%S")
        out.append(item)

    out.sort(key=lambda x: x["date"])
    return out


# ------------------------------------------------------------------
# /api/trade-summary  → SUMMARY ONLY
#    Optional query params:
#       ?from=2025-07-01&to=2025-07-25   (UTC or with timezone)
# ------------------------------------------------------------------
@signal_bp.route("/api/trade-summary", methods=["GET"])
def get_trade_summary():
    df = fetch_all_wide_bars_snapshot()                # DataFrame
    if df is None:
        return jsonify({"error": "Failed to fetch data"}), 500
    if df.empty:
        return jsonify({"data": [], "message": "No rows in table"}), 200

    desired_cols = ["date", "gained_points", "weighted_signal"]

    # ---- keep only columns that actually exist (avoids KeyError) ----
    cols_present = [c for c in desired_cols if c in df.columns]
    if not cols_present:
        return jsonify({"error": "Desired columns not found"}), 500

    df = df[cols_present]

    # ---- convert date column to plain string YYYY-mm-dd HH:MM:SS ----
    df["date"] = (
        pd.to_datetime(df["date"])      # ensure datetime dtype
          .dt.tz_convert(None)          # drop timezone (keeps UTC clock time)
          .dt.strftime("%Y-%m-%d %H:%M:%S")
    )

    # ---- list‑of‑dicts for helpers downstream ----
    rows = df.to_dict(orient="records")
    rows = _normalize_rows(rows, cols_present)   # keep if needed

    # ------ Optional date‑windowing (UTC) -----------------------------
    from_str = request.args.get("from")
    to_str   = request.args.get("to")

    if from_str or to_str:
        def _parse_utc(s: str) -> datetime:
            try:
                dt = dtparser.parse(s)
            except Exception:
                raise ValueError(f"Invalid date '{s}'")
            if dt.tzinfo:
                dt = dt.astimezone(pytz.utc).replace(tzinfo=None)
            return dt

        start_dt = _parse_utc(from_str) if from_str else None
        end_dt   = _parse_utc(to_str)   if to_str   else None

        def _in_range(ts_str: str) -> bool:
            t = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
            if start_dt and t < start_dt:
                return False
            if end_dt and t > end_dt:
                return False
            return True

        rows = [r for r in rows if _in_range(r["date"])]

    # ------ Build & log summary --------------------------------------
    summary = _build_trade_summary_with_weekly(rows)
    _log_trade_summary_with_weekly(summary)

    return jsonify(summary)


# ------------------------------------------------------------------
# 3) Daily + Weekly summary in one go
# ------------------------------------------------------------------
def _build_trade_summary_with_weekly(rows: list) -> dict:
    from collections import defaultdict
    import math
    from decimal import Decimal, InvalidOperation
    from datetime import datetime, timedelta

    def _to_float(v):
        if v is None:
            return None
        try:
            return float(v)
        except (ValueError, TypeError, InvalidOperation):
            return None

    # ---------- Gather all unique calendar dates so we can report no-trade days (daily meta) ----------
    all_dates = sorted({r["date"][:10] for r in rows if r.get("date")})

    # ---------- For weekly tracking, map every row's date -> expiry Thursday (Fri→Thu week) ----------
    def parse_dt(s: str) -> datetime:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")

    all_weeks = set()  # set of expiry Thursday strings YYYY-mm-dd
    per_week = defaultdict(lambda: {
        "sum_gained_points": 0.0,
        "trades": 0,
        "positive_trades": 0,
        "negative_trades": 0,
        "max_gain": -math.inf,
        "max_loss": math.inf,
        "start_date": None,
        "end_date": None,
        "expiry_thursday": None,
        "trade_dates": set(),   # <── NEW
    })

    # ---------- daily buckets ----------
    per_date = defaultdict(lambda: {
        "sum_gained_points": 0.0,
        "trades": 0,
        "positive_trades": 0,
        "negative_trades": 0,
        "max_gain": -math.inf,
        "max_loss": math.inf,
    })

    # ---------- overall ----------
    overall = {
        "sum_gained_points": 0.0,
        "total_trades": 0,
        "positive_trades": 0,
        "negative_trades": 0,
        "max_gain": -math.inf,
        "max_loss": math.inf,
    }

    # ---------- pass ----------
    for r in rows:
        gp = _to_float(r.get("gained_points"))
        if gp is None or abs(gp) < 1e-12:
            continue

        date_str = r["date"][:10]
        dt = parse_dt(r["date"])
        expiry_thu = _expiry_thursday_fri_to_thu(dt)  # <── NEW helper
        week_key = str(expiry_thu)
        all_weeks.add(week_key)

        # --- daily
        d = per_date[date_str]
        d["sum_gained_points"] += gp
        d["trades"] += 1
        if gp > 0:
            d["positive_trades"] += 1
            d["max_gain"] = max(d["max_gain"], gp)
        else:
            d["negative_trades"] += 1
            d["max_loss"] = min(d["max_loss"], gp)

        # --- weekly
        w = per_week[week_key]
        w["sum_gained_points"] += gp
        w["trades"] += 1
        w["trade_dates"].add(date_str)  # <── collect distinct trade dates
        if gp > 0:
            w["positive_trades"] += 1
            w["max_gain"] = max(w["max_gain"], gp)
        else:
            w["negative_trades"] += 1
            w["max_loss"] = min(w["max_loss"], gp)

        if w["expiry_thursday"] is None:
            w["expiry_thursday"] = expiry_thu
            start_date, end_date = _week_bounds_from_expiry_fri_to_thu(expiry_thu)  # <── NEW helper
            w["start_date"] = start_date
            w["end_date"] = end_date

        # --- overall
        overall["sum_gained_points"] += gp
        overall["total_trades"] += 1
        if gp > 0:
            overall["positive_trades"] += 1
            overall["max_gain"] = max(overall["max_gain"], gp)
        else:
            overall["negative_trades"] += 1
            overall["max_loss"] = min(overall["max_loss"], gp)

    # ---------- build per-date table ----------
    by_date = []
    for date_key in sorted(per_date.keys()):
        d = per_date[date_key]
        win_rate = (d["positive_trades"] / d["trades"] * 100.0) if d["trades"] else 0.0
        avg_pts = (d["sum_gained_points"] / d["trades"]) if d["trades"] else 0.0
        max_gain = d["max_gain"] if d["max_gain"] != -math.inf else 0.0
        max_loss = d["max_loss"] if d["max_loss"] != math.inf else 0.0

        by_date.append({
            "date": date_key,
            "trades": d["trades"],
            "positive_trades": d["positive_trades"],
            "negative_trades": d["negative_trades"],
            "win_rate": round(win_rate, 2),
            "sum_gained_points": round(d["sum_gained_points"], 2),
            "avg_gained_points": round(avg_pts, 2),
            "max_gain": round(max_gain, 2),
            "max_loss": round(max_loss, 2),
        })

    # ---------- build per-week table ----------
    by_week = []
    for week_key in sorted(per_week.keys()):
        w = per_week[week_key]
        win_rate = (w["positive_trades"] / w["trades"] * 100.0) if w["trades"] else 0.0
        avg_pts = (w["sum_gained_points"] / w["trades"]) if w["trades"] else 0.0
        max_gain = w["max_gain"] if w["max_gain"] != -math.inf else 0.0
        max_loss = w["max_loss"] if w["max_loss"] != math.inf else 0.0

        # expected Fri→Thu trading days (Mon–Fri filter, but we only want Fri, Mon, Tue, Wed, Thu)
        expected = []
        cur = w["start_date"]
        while cur <= w["end_date"]:
            # Keep only weekdays (Mon=0..Fri=5); Sat/Sun ignored
            if cur.weekday() < 5:
                expected.append(str(cur))
            cur += timedelta(days=1)

        missing = [d for d in expected if d not in w["trade_dates"]]

        by_week.append({
            "expiry_thursday": str(w["expiry_thursday"]),
            "start_date": str(w["start_date"]),
            "end_date": str(w["end_date"]),
            "trades": w["trades"],
            "positive_trades": w["positive_trades"],
            "negative_trades": w["negative_trades"],
            "win_rate": round(win_rate, 2),
            "sum_gained_points": round(w["sum_gained_points"], 2),
            "avg_gained_points": round(avg_pts, 2),
            "max_gain": round(max_gain, 2),
            "max_loss": round(max_loss, 2),
            "trade_days": len(w["trade_dates"]),                 # <── NEW
            "expected_trade_days": len(expected),                # <── NEW (typically 5)
            "missing_trade_dates": missing,                      # <── NEW
        })

    # ---------- overall ----------
    if overall["total_trades"] > 0:
        overall_win_rate = overall["positive_trades"] / overall["total_trades"] * 100.0
        overall_avg = overall["sum_gained_points"] / overall["total_trades"]
    else:
        overall_win_rate = 0.0
        overall_avg = 0.0

    overall_max_gain = overall["max_gain"] if overall["max_gain"] != -math.inf else 0.0
    overall_max_loss = overall["max_loss"] if overall["max_loss"] != math.inf else 0.0

    overall_summary = {
        "total_trades": overall["total_trades"],
        "positive_trades": overall["positive_trades"],
        "negative_trades": overall["negative_trades"],
        "win_rate": round(overall_win_rate, 2),
        "sum_gained_points": round(overall["sum_gained_points"], 2),
        "avg_gained_points": round(overall_avg, 2),
        "max_gain": round(overall_max_gain, 2),
        "max_loss": round(overall_max_loss, 2),
    }

    # ---------- daily meta ----------
    dates_with_trades = {d["date"] for d in by_date}
    no_trade_dates = [d for d in all_dates if d not in dates_with_trades]
    trade_days_count = len(dates_with_trades)
    total_days_in_data = len(all_dates)
    no_trade_days_count = len(no_trade_dates)
    trade_day_hit_rate = round(
        (trade_days_count / total_days_in_data * 100.0) if total_days_in_data else 0.0, 2
    )

    # ---------- weekly meta ----------
    all_weeks_sorted = sorted(all_weeks)  # all expiry Thursdays present in the data
    weeks_with_trades = {w["expiry_thursday"] for w in by_week}
    no_trade_weeks = [w for w in all_weeks_sorted if w not in weeks_with_trades]
    trade_weeks_count = len(weeks_with_trades)
    total_weeks_in_data = len(all_weeks_sorted)
    no_trade_weeks_count = len(no_trade_weeks)
    trade_week_hit_rate = round(
        (trade_weeks_count / total_weeks_in_data * 100.0) if total_weeks_in_data else 0.0, 2
    )

    return {
        "overall": overall_summary,
        "by_date": by_date,
        "no_trade_dates": no_trade_dates,
        "no_trade_days_count": no_trade_days_count,
        "trade_days_count": trade_days_count,
        "total_days_in_data": total_days_in_data,
        "trade_day_hit_rate": trade_day_hit_rate,

        "by_week": by_week,
        "weekly_meta": {
            "total_weeks_in_data": total_weeks_in_data,
            "trade_weeks_count": trade_weeks_count,
            "no_trade_weeks_count": no_trade_weeks_count,
            "no_trade_weeks": no_trade_weeks,
            "trade_week_hit_rate": trade_week_hit_rate,
        }
    }


# ------------------------------------------------------------------
# 4) Extended logger: also prints the weekly block
# ------------------------------------------------------------------
def _log_trade_summary_with_weekly(summary: dict) -> None:
    import logging

    overall        = summary["overall"]
    by_date        = summary["by_date"]
    by_week        = summary.get("by_week", [])
    no_trade_dates = summary.get("no_trade_dates", [])
    weekly_meta    = summary.get("weekly_meta", {})

    lines = []

    # -------- overall --------
    lines.append("====== TRADE SUMMARY (OVERALL) ======")
    lines.append(
        "Trades     : {total_trades:d} (win={positive_trades:d}, loss={negative_trades:d}, win%={win_rate:.2f})"
        .format(**overall)
    )
    lines.append("Sum Points : {sum_gained_points:.2f}".format(**overall))
    lines.append("Avg Points : {avg_gained_points:.2f}".format(**overall))
    lines.append("Max Gain   : {max_gain:.2f}".format(**overall))
    lines.append("Max Loss   : {max_loss:.2f}".format(**overall))
    lines.append("=====================================")

    # -------- by date --------
    if by_date:
        lines.append("====== TRADE SUMMARY (BY DATE) ======")
        header = (
            f"{'Date':<12} "
            f"{'Trades':>6} "
            f"{'Win':>6} "
            f"{'Loss':>6} "
            f"{'Win%':>7} "
            f"{'SumPts':>10} "
            f"{'AvgPts':>10} "
            f"{'MaxGain':>10} "
            f"{'MaxLoss':>10}"
        )
        lines.append(header)
        lines.append("-" * len(header))
        for d in by_date:
            lines.append(
                f"{d['date']:<12} "
                f"{d['trades']:>6d} "
                f"{d['positive_trades']:>6d} "
                f"{d['negative_trades']:>6d} "
                f"{d['win_rate']:>7.2f} "
                f"{d['sum_gained_points']:>10.2f} "
                f"{d['avg_gained_points']:>10.2f} "
                f"{d['max_gain']:>10.2f} "
                f"{d['max_loss']:>10.2f}"
            )
        lines.append("=====================================")
    else:
        lines.append("No per-date trades.")
        lines.append("=====================================")

    # -------- DAILY META --------
    lines.append("====== META (DAILY) ======")
    lines.append(f"Total days in data  : {summary.get('total_days_in_data', 0)}")
    lines.append(f"Trade days (non‑zero): {summary.get('trade_days_count', 0)}")
    lines.append(f"No‑trade days        : {summary.get('no_trade_days_count', 0)}")
    lines.append(f"Trade day hit‑rate   : {summary.get('trade_day_hit_rate', 0):.2f}%")
    lines.append("=====================================")

    if no_trade_dates:
        lines.append("====== NO-TRADE DATES (0 non‑zero trades) ======")
        for d in no_trade_dates:
            lines.append(d)
        lines.append("=====================================")

    # -------- by week (expiry) --------
    if by_week:
        lines.append("====== TRADE SUMMARY (BY WEEK / EXPIRY THURSDAY) ======")
        header = (
            f"{'ExpiryThu':<12} "
            f"{'Start':<12} "
            f"{'End':<12} "
            f"{'TrDays':>6} "
            f"{'Exp':>4} "
            f"{'Trades':>6} "
            f"{'Win':>6} "
            f"{'Loss':>6} "
            f"{'Win%':>7} "
            f"{'SumPts':>10} "
            f"{'AvgPts':>10} "
            f"{'MaxGain':>10} "
            f"{'MaxLoss':>10}"
        )
        lines.append(header)
        lines.append("-" * len(header))

        for w in by_week:
            lines.append(
                f"{w['expiry_thursday']:<12} "
                f"{w['start_date']:<12} "
                f"{w['end_date']:<12} "
                f"{w.get('trade_days', 0):>6d} "
                f"{w.get('expected_trade_days', 0):>4d} "
                f"{w['trades']:>6d} "
                f"{w['positive_trades']:>6d} "
                f"{w['negative_trades']:>6d} "
                f"{w['win_rate']:>7.2f} "
                f"{w['sum_gained_points']:>10.2f} "
                f"{w['avg_gained_points']:>10.2f} "
                f"{w['max_gain']:>10.2f} "
                f"{w['max_loss']:>10.2f}"
            )

            # Print missing only if present
            missing = w.get("missing_trade_dates") or []
            if missing:
                lines.append(f"    missing_trade_dates: {', '.join(missing)}")

        lines.append("=====================================")
    else:
        lines.append("No per-week trades.")
        lines.append("=====================================")

    # -------- WEEKLY META --------
    if weekly_meta:
        lines.append("====== META (WEEKLY) ======")
        lines.append(f"Total weeks in data  : {weekly_meta.get('total_weeks_in_data', 0)}")
        lines.append(f"Trade weeks (non‑zero): {weekly_meta.get('trade_weeks_count', 0)}")
        lines.append(f"No‑trade weeks        : {weekly_meta.get('no_trade_weeks_count', 0)}")
        lines.append(f"Trade week hit‑rate   : {weekly_meta.get('trade_week_hit_rate', 0):.2f}%")
        lines.append("=====================================")

        if weekly_meta.get("no_trade_weeks"):
            lines.append("====== NO-TRADE WEEKS (0 non‑zero trades) ======")
            for w in weekly_meta["no_trade_weeks"]:
                lines.append(str(w))
            lines.append("=====================================")

    logging.getLogger(__name__).info("\n%s", "\n".join(lines))



@signal_bp.route('/api/trailing-stop-parameters', methods=['GET'])
def get_trailing_stop_parameters():
    """
    API endpoint that returns the trailing-stop parameters for a given user.
    Expects:
        ?userid=<your_user_id>
    """
    userid = request.args.get('userid')
    if not userid:
        return jsonify({"error": "Missing required query parameter: userid"}), 400

    try:
        params = load_trailing_stop_loss_parameters(userid)
        if not params:
            # no row in config_map → 404 so caller knows to apply defaults
            return jsonify({"message": f"No configuration found for user {userid}"}), 404

        # successful fetch
        return jsonify(params), 200

    except Exception:
        logger.exception("Failed to load trailing-stop parameters for user %s", userid)
        return jsonify({"error": "Failed to fetch parameters"}), 500


@signal_bp.route('/api/trailing-stop-parameters/<string:userid>', methods=['PUT'])
def update_trailing_stop_parameters_endpoint(userid):
    """
    Update the trailing-stop parameters for a given user.
    Expects JSON body with exactly these keys (all required):
      - pnl_min_threshold
      - pnl_max_threshold
      - initial_stop_loss_percentage
      - trailing_trigger_percentage
      - trailing_step_threshold_pct
      - trailing_step_increment_pct
    """
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON"}), 400

    payload = request.get_json()
    expected_keys = {
        "pnl_min_threshold",
        "pnl_max_threshold",
        "initial_stop_loss_percentage",
        "trailing_trigger_percentage",
        "trailing_step_threshold_pct",
        "trailing_step_increment_pct",
    }

    missing = expected_keys - payload.keys()
    if missing:
        return jsonify({
            "error": "Missing parameters",
            "missing_keys": list(missing)
        }), 400

    try:
        updated = update_trailing_stop_loss_parameters(userid, payload)
        if not updated:
            # either no row existed or update failed
            return jsonify({
                "error": f"No configuration found for user {userid} or update did not occur"
            }), 404

        return jsonify({
            "message": f"Trailing-stop parameters updated for user {userid}"
        }), 200

    except Exception:
        logger.exception("API error updating trailing-stop parameters for user %s", userid)
        return jsonify({"error": "Internal server error"}), 500


@signal_bp.route('/api/userid-by-email', methods=['GET'])
def get_userid_endpoint():
    """
    API endpoint that returns the userid for a given emailid.
    Expects:
        ?emailid=<user_email_address>
    """
    emailid = request.args.get('emailid')
    if not emailid:
        return jsonify({"error": "Missing required query parameter: emailid"}), 400

    try:
        userid = get_userid_by_email(emailid)
        if not userid:
            # no matching row
            return jsonify({"message": f"No user found for emailid {emailid}"}), 404

        # successful lookup
        return jsonify({"userid": userid}), 200

    except Exception:
        logger.exception("Failed to fetch userid for emailid %s", emailid)
        return jsonify({"error": "Internal server error"}), 500


# ────────────────────────── constants ───────────────────────────
UNIVERSE: List[Dict] = [
    {"token": 128083204, "symbol": "RELIANCE",   "weight": 9.62},
    {"token": 128046084, "symbol": "HDFCBANK",   "weight": 7.75},
    {"token": 2714625,   "symbol": "BHARTIARTL", "weight": 5.85},
    {"token": 2953217,   "symbol": "TCS",        "weight": 5.75},
    {"token": 136236548, "symbol": "ICICIBANK",  "weight": 5.30},
    {"token": 128028676, "symbol": "SBIN",       "weight": 3.79},
    {"token": 408065,    "symbol": "INFY",       "weight": 3.28},
    {"token": 128008708, "symbol": "BAJFINANCE", "weight": 2.98},
    {"token": 128178180, "symbol": "HINDUNILVR", "weight": 2.93},
    {"token": 128224004, "symbol": "ITC",        "weight": 2.62},
]
TOTAL_WEIGHT = sum(s["weight"] for s in UNIVERSE)

# NIFTY 50 spot index – pulled only for raw OHLCV
NIFTY50_TOKEN = 256265
NIFTY50_COLS  = {
    "open":   "current_open",
    "high":   "current_high",
    "low":    "current_low",
    "close":  "current_close",
    "volume": "current_volume",
}
VIX_TOKEN = 2815745  # India VIX token
VIX_COL = "vix"
# ───────────────────── eight‑vote micro‑signal ───────────────────
def _calc_row_signal(df: pd.DataFrame) -> pd.Series:
    if len(df) < 2:
        return pd.Series(["HOLD"] * len(df), index=df.index, dtype="string")

    sig = ["HOLD"] * len(df)

    for i in range(1, len(df)):
        cur, prev = df.iloc[i], df.iloc[i - 1]

        # 1. Trend Direction (Weighted 2x)
        trend_score = 0
        trend_score += 2 if cur["close"] > cur["VWAP_D"] else -2
        trend_score += 2 if cur["EMA_5"] > cur["EMA_13"] else -2
        trend_score += 1 if cur["MACDh_12_26_9"] > 0 else -1

        # 2. Momentum & Volume
        mom_score = 0
        # RSI with more granular zones
        if cur["RSI_9"] > 60:
            mom_score += 1.5
        elif cur["RSI_9"] > 55:
            mom_score += 0.5
        elif cur["RSI_9"] < 40:
            mom_score -= 1.5
        elif cur["RSI_9"] < 45:
            mom_score -= 0.5

        mom_score += 1 if cur["OBV"] > prev["OBV"] else -1
        mom_score += 1 if cur["CMF_20"] > 0 else -1

        # 3. Confirmation Signals
        conf_score = 0
        # BBP with buffer zones
        if cur["BBP_14_2.0"] > 0.7:  # Strong overbought
            conf_score -= 1.5
        elif cur["BBP_14_2.0"] > 0.6:
            conf_score -= 0.5
        elif cur["BBP_14_2.0"] < 0.3:  # Strong oversold
            conf_score += 1.5
        elif cur["BBP_14_2.0"] < 0.4:
            conf_score += 0.5

        # ADX directional awareness
        if cur["ADX_14"] > 20:
            # Confirm existing trend direction
            conf_score += 1 if trend_score > 0 else -1 if trend_score < 0 else 0

        total_score = trend_score + mom_score + conf_score

        # Normalize to [-10,10] range
        normalized = total_score / 10.0

        # Thresholds (more conservative)
        if normalized >= 0.3:  # ~3/10 indicators agree strongly
            sig[i] = "BUY"
        elif normalized <= -0.3:
            sig[i] = "SELL"
        else:
            sig[i] = "HOLD"

    return pd.Series(sig, index=df.index, dtype="string")

# ───────────────────────── main helper ──────────────────────────

# ------------------------------------------------------------------
# 🚀 fetch_universe_bars ‑ FULL IMPLEMENTATION
# ------------------------------------------------------------------
def fetch_universe_bars(
    kite: KiteConnect,
    interval: str,
    lookback_days: int = 30,
) -> pd.DataFrame:
    """
    Build a *wide* OHLCV DataFrame:

        • One column‑bundle per stock in UNIVERSE
        • Row‑level micro‑signals for each stock
        • Weighted market‑level signal (stocks only; dynamic VIX threshold)
        • Raw NIFTY 50 OHLCV (renamed to current_*)
        • India VIX values for the same timestamps

    Notes
    -----
    • Early‑morning bars (09:15–11:00) are **not** dropped even when
      indicator columns are still NaN.
    • The function logs every fetch (success, empty, or error) with row counts.
    """
    # ------------------------------------------------------------------
    # 1️⃣ Time window
    # ------------------------------------------------------------------
    end_dt   = datetime.now(IST)
    start_dt = (end_dt - timedelta(days=lookback_days)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    wide_df: pd.DataFrame | None = None

    # ------------------------------------------------------------------
    # 2️⃣ Loop through UNIVERSE stocks
    # ------------------------------------------------------------------
    for stk in UNIVERSE:
        token  = stk["token"]
        symbol = stk["symbol"]

        # -- Attempt fetch ------------------------------------------------
        try:
            logger.debug("Fetching %s (%s) [%s]", symbol, token, interval)
            candles = kite.historical_data(
                token,
                from_date=start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                to_date=end_dt.strftime("%Y-%m-%d %H:%M:%S"),
                interval=interval,
                oi=True,
            )
        except Exception as exc:                               # noqa: BLE001
            logger.error("❌  Failed to fetch %s (%s): %s", symbol, token, exc)
            continue

        time.sleep(0.6)  # stay comfortably < 3 req/s

        if not candles:
            logger.warning("⚠️  No candles returned for %s (%s)", symbol, token)
            continue
        logger.info("✅  Fetched %4d rows for %s (%s)", len(candles), symbol, token)

        # -- Build DataFrame ---------------------------------------------
        df = pd.DataFrame(candles)

        df["date"] = pd.to_datetime(df["date"])
        if df["date"].dt.tz is None:
            df["date"] = df["date"].dt.tz_localize(IST)
        else:
            df["date"] = df["date"].dt.tz_convert(IST)

        sym = symbol.lower()

        # -- Indicators ---------------------------------------------------
        ind = df.set_index("date").sort_index()
        ind.index = ind.index.tz_localize(None)  # make pandas_ta happy

        ind.ta.vwap(append=True)
        ind.ta.obv(append=True)
        ind.ta.rsi(length=9, append=True)
        ind.ta.ema(length=5, append=True)
        ind.ta.ema(length=13, append=True)
        ind.ta.macd(append=True)
        ind.ta.bbands(length=14, std=2.0, append=True)
        ind.ta.cmf(length=20, append=True)
        ind.ta.adx(length=14, append=True)

        ind = ind.copy()
        ind["signal"] = _calc_row_signal(ind)   # -> BUY / SELL / HOLD

        sel = (
            ind[["open", "high", "low", "close", "volume", "signal"]]
            .rename(
                columns={
                    "open":   f"{sym}_open",
                    "high":   f"{sym}_high",
                    "low":    f"{sym}_low",
                    "close":  f"{sym}_close",
                    "volume": f"{sym}_volume",
                    "signal": f"{sym}_signal",
                }
            )
            .reset_index()  # bring “date” back as a column
        )

        wide_df = sel if wide_df is None else wide_df.merge(sel, on="date", how="outer")

    # ------------------------------------------------------------------
    # 3️⃣ NIFTY 50 spot index
    # ------------------------------------------------------------------
    try:
        logger.debug("Fetching NIFTY50 (%s) [%s]", NIFTY50_TOKEN, interval)
        idx_candles = kite.historical_data(
            NIFTY50_TOKEN,
            from_date=start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            to_date=end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            interval=interval,
            oi=False,  # spot index → no open‑interest
        )
    except Exception as exc:                                   # noqa: BLE001
        logger.error("❌  Failed to fetch NIFTY50: %s", exc)
        idx_candles = []
    time.sleep(0.6)

    if not idx_candles:
        logger.warning("⚠️  No candles returned for NIFTY50")
    else:
        logger.info("✅  Fetched %4d rows for NIFTY50", len(idx_candles))

        idx_df = pd.DataFrame(idx_candles)
        idx_df["date"] = pd.to_datetime(idx_df["date"])
        if idx_df["date"].dt.tz is None:
            idx_df["date"] = idx_df["date"].dt.tz_localize(IST)
        else:
            idx_df["date"] = idx_df["date"].dt.tz_convert(IST)

        idx_sel = (
            idx_df[["date", "open", "high", "low", "close", "volume"]]
            .rename(columns=NIFTY50_COLS)  # e.g. open -> current_open
        )
        idx_sel["date"] = idx_sel["date"].dt.tz_localize(None)

        wide_df = idx_sel if wide_df is None else wide_df.merge(idx_sel, on="date", how="outer")

    # ------------------------------------------------------------------
    # 4️⃣ India VIX index
    # ------------------------------------------------------------------
    try:
        logger.debug("Fetching India VIX (%s) [%s]", VIX_TOKEN, interval)
        vix_candles = kite.historical_data(
            VIX_TOKEN,
            from_date=start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            to_date=end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            interval=interval,
            oi=False,
        )
    except Exception as exc:                                   # noqa: BLE001
        logger.error("❌  Failed to fetch India VIX: %s", exc)
        vix_candles = []
    time.sleep(0.6)

    if not vix_candles:
        logger.warning("⚠️  No candles returned for India VIX")
    else:
        logger.info("✅  Fetched %4d rows for India VIX", len(vix_candles))

        vix_df = pd.DataFrame(vix_candles)
        vix_df["date"] = pd.to_datetime(vix_df["date"])
        if vix_df["date"].dt.tz is None:
            vix_df["date"] = vix_df["date"].dt.tz_localize(IST)
        else:
            vix_df["date"] = vix_df["date"].dt.tz_convert(IST)

        vix_sel = vix_df[["date", "close"]].rename(columns={"close": VIX_COL})
        vix_sel["date"] = vix_sel["date"].dt.tz_localize(None)

        # left‑join → keep market rows even if VIX missing
        wide_df = wide_df.merge(vix_sel, on="date", how="left")
        wide_df[VIX_COL] = wide_df[VIX_COL].ffill().bfill()

    # ------------------------------------------------------------------
    # 5️⃣ Weighted‑signal + dynamic VIX‑threshold
    # ------------------------------------------------------------------
    if wide_df is None:
        logger.warning("🚫  All fetches failed – returning empty DataFrame")
        return pd.DataFrame()

    wide_df = wide_df.sort_values("date").reset_index(drop=True)
    wide_df["date"] = wide_df["date"].dt.tz_localize(IST)

    mapping   = {"BUY": 1, "SELL": -1, "HOLD": 0}
    sig_cols  = [c for c in wide_df.columns if c.endswith("_signal")]

    weight_map: Dict[str, float] = {s["symbol"].lower(): s["weight"] for s in UNIVERSE}
    total_wt = sum(weight_map.values())

    # map BUY/SELL/HOLD→1/‑1/0 and multiply by weights
    score_mat = wide_df[sig_cols].apply(lambda col: col.map(mapping).astype(float))
    w_vec     = [weight_map[c.split("_")[0]] for c in sig_cols]
    weighted_avg = score_mat.mul(w_vec).sum(axis=1) / total_wt

    # -- Dynamic threshold from VIX --------------------------------------
    def vix_to_threshold(vix_value: float) -> float:
        vix_min, vix_max = 10, 30      # typical range for INDIAVIX
        clipped = max(vix_min, min(vix_max, vix_value))
        norm    = (clipped - vix_min) / (vix_max - vix_min)
        return 0.10 + 0.10 * norm      # → 0.10 … 0.20

    thresholds = wide_df[VIX_COL].apply(vix_to_threshold)

    weighted_signal: List[str] = []
    for wa, th in zip(weighted_avg, thresholds, strict=False):
        if wa >=  th:
            weighted_signal.append("Buy")
        elif wa <= -th:
            weighted_signal.append("Sell")
        else:
            weighted_signal.append("NoTrade")

    wide_df["weighted_signal"] = weighted_signal
    wide_df["vix_value"]       = wide_df[VIX_COL]   # debug/analysis
    wide_df["threshold"]       = thresholds         # debug/analysis

    return wide_df


def initiate_trail_stoploss_for_existing_position(userid, live_trade, index_token):
    try:
        print('......Inside Intial trail stop loss......')
        if live_trade:
            positions = fetch_all_positions(userid)
            record = fetch_order_tracker(positions)  # Now returns a single dict or None.
        else:
            record = fetch_single_order_by_zerodha_id(userid)
        if not record:
            logger.info(f"No order tracker record found for {userid} to start initial trailing stop loss")
            return False

        if record:
            logger.info(f"Restoring cache from DB for {userid}: {record['tradingsymbol']}")
            set_order_cache(userid, {
                "tradingsymbol": record["tradingsymbol"],
                "quantity": record["quantity"],
                "instrument_token": record["instrument_token"]
            })
        else:
            logger.info(f"No open position to restore for {userid}")

        tradingsymbol = record.get('tradingsymbol')
        instrument_token = record.get('instrument_token')

        start_trailing_thread(
            userid,
            tradingsymbol,
            instrument_token,
            index_token,
            live_trade
        )

        # Log after starting the thread
        logger.info(f"Trailing stoploss initiated for existing position: {tradingsymbol}")

    except Exception as e:
        logger.error(f"Error starting trailing stoploss for user : {e}")


# ─────────────────────────────────────────────────────────────────────────────
def process_data(
    user_id: str,
    token: int,
    candle_size: str,
    trading_in: str,
    risk_percentage: float,
    historicl_day: int,
    product_type: str,
    live_trade: bool,
):
    logger.info("Inside process_data")
    output_dir = "data/output/csv"
    os.makedirs(output_dir, exist_ok=True)
    target_times = generate_target_times(15)

    # ─── 0) INIT ────────────────────────────────────────────────────────────
    kite_instance = get_user_kite_instance(user_id)
    if kite_instance is None:
        logger.error("Failed to get kite instance for user %s", user_id)
        return

    for p in ("data/output/models", "data/output/charts", "data/output/csv"):
        os.makedirs(p, exist_ok=True)

    allowed_quantities = {
        260105: {"name": "BANKNIFTY", "quantity": 900},
        257801: {"name": "FINNIFTY", "quantity": 1800},
        288009: {"name": "MIDCPNIFTY", "quantity": 2800},
        256265: {"name": "NIFTY", "quantity": 1800},
        265:     {"name": "SENSEX", "quantity": 1000},
    }
    if token not in allowed_quantities:
        logger.error("Token %s is not allowed.", token)
        return
    name_data = allowed_quantities[token]["name"]

    TIMEFRAME = "15minute"
    now_ist = datetime.now(IST)
    logger.info("🕒 Loop start @ %s", now_ist.strftime("%H:%M:%S"))

    logger.info("🔥 First run: Fetching all time intervals…")

    # ─── 2) refresh contributor OHLCV frames when a new bar prints ──────
    output_dir = Path("data/output/csv")
    output_dir.mkdir(parents=True, exist_ok=True)

    # ───────────────────────────── MAIN LOOP ────────────────────────────────
    while True:
        # ── 2️⃣  Fetch bars ────────────────────────────────────────────────────────
        df = fetch_universe_bars(kite_instance, TIMEFRAME, lookback_days=historicl_day)
        logger.info("Fetched contributor OHLCV for %s (%d rows)", TIMEFRAME, len(df))

        # ── 3️⃣  Persist to disk if we actually received data ──────────────────────
        if not df.empty:
            csv_name = f"contributors_{TIMEFRAME}_{now_ist:%Y%m%d}.csv"
            csv_path = output_dir / csv_name

            df.to_csv(
                csv_path,
                index=False,
                date_format="%Y-%m-%d %H:%M:%S%z"
            )
            logger.info("💾 Saved %s", csv_path)
        else:
            logger.warning("No data for %s; skipping CSV write", TIMEFRAME)

        # ── 4️⃣  Generate signals using the fresh frame ────────────────────────────
        signal_high_low_df = generate_signals(
            df,  # <‑‑ pass the DataFrame you just fetched
            kite_instance,
            live_trade,
            user_id,
            token
        )


        profit_df = calculate_profit(signal_high_low_df)
        total_pts = profit_df['gained_points'].sum()
        print("Total gained points:", total_pts)
        insert_wide_bars_snapshot(profit_df)
        delete_all_wide_bars()
        count = insert_wide_bars(profit_df)
        print(f"Inserted {count}")
        # ✅ Print last 10 rows safely
        if profit_df is not None and not profit_df.empty:
            required_columns = {
                "date": "Date",
                "current_open": "Open",
                "current_high": "High",
                "current_low": "Low",
                "current_close": "Close",
                "weighted_signal": "Signal",
                "gained_points": "Gained Points"
            }
            # Ensure only existing columns are selected to avoid errors
            available_columns = {col: required_columns[col] for col in required_columns if col in profit_df.columns}

            profit_df_selected = profit_df[list(available_columns.keys())].rename(columns=available_columns)
            print("\n📊 Selected Columns from profit_df with renamed column names:\n")
            print(profit_df_selected.tail(60).to_string(index=False) + "\n")
            print("\n")
            profit_df.to_csv(os.path.join(output_dir, "profit_df_new.csv"), index=False)

        else:
            logger.warning("⚠️ Warning: `profit_df` is empty! No data to print.")
        latest = fetch_latest_weighted_signals()
        current_signal = 'NoTrade'
        previous_signal = 'NoTrade'
        if latest:
            # Newest bar first
            current_signal = latest[0]["weighted_signal"]  # e.g. 'NoTrade'
            previous_signal = latest[1]["weighted_signal"]  # e.g. 'NoTrade'
            time_now = latest[0]["ist_time"]  # '11:45'
            logging.info("Latest weighted‑signals: %s @ %s, previous %s",
                         current_signal, time_now, previous_signal)
        else:
            logging.warning("No weighted‑signal rows found for today!")
        #current_signal = signal_high_low_df["Final_Signal"].iloc[-1] if len(signal_high_low_df) >= 1 else None
        #previous_signal = signal_high_low_df["Final_Signal"].iloc[-2] if len(signal_high_low_df) >= 2 else None

        priority_trigger = signal_high_low_df["Priority_Trigger"].iloc[-1] if len(signal_high_low_df) >= 1 else None

        close = signal_high_low_df["current_close"].iloc[
            -1] if "current_close" in signal_high_low_df.columns else None

        print(f"🔹 Previous Signal: {previous_signal}")
        print(f"🔹 Current Signal: {current_signal}")
        print(f"🔹 Current Priority Trigger: {priority_trigger}")
        trade_action = get_today_trade_action()
        print(f"Today's trade action from OI: {trade_action}")
        tag = "AI_Signal"
        source = 'AI'

        if priority_trigger is not None and priority_trigger == 'Primary_1':
            strength = 'Strong'
            ai_signal = 'HL-SIGNAL'
        elif priority_trigger is not None and priority_trigger == 'Primary_2':
            strength = 'Medium'
            ai_signal = 'SUPER-MACD-SIGNAL'
        elif priority_trigger is not None and priority_trigger == 'Primary_3':
            strength = 'Weak'
            ai_signal = 'NO-TRADE-SIDEWAYS'
        elif priority_trigger is not None and priority_trigger == 'Primary_4':
            strength = 'Weak'
            ai_signal = 'NO-TRADE'
        else:
            strength = 'Weak'
            ai_signal = 'NO-TRADE'

        place_order_service(
            current_signal, close, name_data, previous_signal, risk_percentage, token, trading_in, user_id,
            product_type, live_trade, tag, strength, ai_signal, source, priority_trigger)

        # 1️⃣ EXECUTE TASK
        logger.info("Executing scheduled task...")

        now = datetime.now(IST).time()
        next_time = next((t for t in target_times if t > now), None)

        if not next_time:  # No more runs today; wait for tomorrow's first time
            next_time = target_times[0]
            wait_until(next_time)
        else:
            wait_until(next_time)

        # Execute the trading task
        logger.info("✅ Executing scheduled task at %s", datetime.now(IST).strftime("%H:%M"))


def generate_target_times(interval):
    """Generate target times in IST, starting at 09:16 with a 15-minute first interval."""
    times = []
    # Create timezone-aware datetime objects for start/end
    base_date = datetime.now(IST).date()  # Use today's date as a reference
    start = IST.localize(datetime.combine(base_date, datetime.strptime("09:16", "%H:%M").time()))
    end = IST.localize(datetime.combine(base_date, datetime.strptime("15:31", "%H:%M").time()))

    current = start
    while current <= end:
        times.append(current.time())
        if len(times) == 1:
            current += timedelta(minutes=15)  # First interval: 15 minutes
        else:
            current += timedelta(minutes=interval)  # Subsequent intervals

    return times


def wait_until(target_time):
    """Sleep until the next target time (in IST)."""
    now = datetime.now(IST)
    target = datetime.combine(now.date(), target_time).astimezone(IST)
    if target < now:
        target += timedelta(days=1)  # Move to tomorrow if already passed
    delay = (target - now).total_seconds()
    if delay > 0:
        logger.info(f"⏳ Sleeping until {target.strftime('%H:%M')}...")
        time.sleep(delay)