# Position API Endpoints Documentation

## Overview
This document provides a comprehensive list of all Position API endpoints with their URL patterns, HTTP methods, parameters, and response structures.

**Base URL**: `/api/positions`

---

## CREATE Operations

### 1. Create Single Position
- **Endpoint**: `POST /api/positions`
- **Description**: Create a new position record
- **Request Body**:
```json
{
  "average_price": 100.50,
  "buy_m2m": 1000.00,
  "buy_price": 100.00,
  "buy_quantity": 100,
  "buy_value": 10000.00,
  "close_price": 105.00,
  "day_buy_price": 100.00,
  "day_buy_quantity": 100,
  "day_buy_value": 10000.00,
  "day_sell_price": 105.00,
  "day_sell_quantity": 50,
  "day_sell_value": 5250.00,
  "exchange": "NSE",
  "instrument_token": "12345678",
  "last_price": 105.50,
  "m2m": 500.00,
  "multiplier": 1,
  "overnight_quantity": 50,
  "pnl": 250.00,
  "product": "MIS",
  "quantity": 50,
  "realised": 100.00,
  "sell_m2m": 500.00,
  "sell_price": 105.00,
  "sell_quantity": 50,
  "sell_value": 5250.00,
  "tradingsymbol": "NIFTY25AUG25000CE",
  "unrealised": 150.00,
  "value": 5250.00,
  "transaction_date": "2025-08-04T10:30:00"
}
```
- **Response**:
```json
{
  "status": "success",
  "message": "Position created successfully"
}
```

### 2. Bulk Create Positions
- **Endpoint**: `POST /api/positions/bulk`
- **Description**: Create multiple position records
- **Request Body**:
```json
{
  "positions": [
    { /* position object 1 */ },
    { /* position object 2 */ }
  ]
}
```
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully created 2 positions",
  "created_count": 2
}
```

---

## READ Operations

### 3. Get All Positions
- **Endpoint**: `GET /api/positions`
- **Description**: Retrieve all position records
- **Query Parameters**: 
  - `limit` (optional): Number of records to return
  - `offset` (optional): Number of records to skip
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully fetched 150 positions",
  "data": [
    {
      "average_price": 100.50,
      "buy_m2m": 1000.00,
      "buy_price": 100.00,
      "buy_quantity": 100,
      "buy_value": 10000.00,
      "close_price": 105.00,
      "day_buy_price": 100.00,
      "day_buy_quantity": 100,
      "day_buy_value": 10000.00,
      "day_sell_price": 105.00,
      "day_sell_quantity": 50,
      "day_sell_value": 5250.00,
      "exchange": "NSE",
      "instrument_token": "12345678",
      "last_price": 105.50,
      "m2m": 500.00,
      "multiplier": 1,
      "overnight_quantity": 50,
      "pnl": 250.00,
      "product": "MIS",
      "quantity": 50,
      "realised": 100.00,
      "sell_m2m": 500.00,
      "sell_price": 105.00,
      "sell_quantity": 50,
      "sell_value": 5250.00,
      "tradingsymbol": "NIFTY25AUG25000CE",
      "unrealised": 150.00,
      "value": 5250.00,
      "transaction_date": "2025-08-04T10:30:00+00:00"
    }
  ],
  "count": 150
}
```

### 4. Get Positions for Current Date
- **Endpoint**: `GET /api/positions/current-date`
- **Description**: Retrieve all positions for the current date
- **Response**: Same structure as Get All Positions

### 5. Get Positions by Date
- **Endpoint**: `GET /api/positions/by-date`
- **Description**: Retrieve positions for a specific date
- **Query Parameters**:
  - `date` (required): Date in YYYY-MM-DD format
- **Response**: Same structure as Get All Positions

### 6. Get Positions by Date Range
- **Endpoint**: `GET /api/positions/date-range`
- **Description**: Retrieve positions within a date range
- **Query Parameters**:
  - `start_date` (required): Start date in YYYY-MM-DD format
  - `end_date` (required): End date in YYYY-MM-DD format
- **Response**: Same structure as Get All Positions

### 7. Get Positions by Symbol
- **Endpoint**: `GET /api/positions/by-symbol/<symbol>`
- **Description**: Retrieve all positions for a specific trading symbol
- **URL Parameters**:
  - `symbol`: Trading symbol (e.g., NIFTY25AUG25000CE)
- **Response**: Same structure as Get All Positions

### 8. Get Positions by Date and Symbol
- **Endpoint**: `GET /api/positions/by-date-and-symbol`
- **Description**: Retrieve positions for a specific date and symbol
- **Query Parameters**:
  - `date` (required): Date in YYYY-MM-DD format
  - `symbol` (required): Trading symbol
- **Response**: Same structure as Get All Positions

### 9. Get Positions by P&L Range
- **Endpoint**: `GET /api/positions/by-pnl`
- **Description**: Retrieve positions within a P&L range
- **Query Parameters**:
  - `min_pnl` (optional): Minimum P&L value
  - `max_pnl` (optional): Maximum P&L value
- **Response**: Same structure as Get All Positions

### 10. Get Profitable Positions
- **Endpoint**: `GET /api/positions/profitable`
- **Description**: Retrieve all positions with positive P&L
- **Response**: Same structure as Get All Positions

### 11. Get Loss-Making Positions
- **Endpoint**: `GET /api/positions/loss-making`
- **Description**: Retrieve all positions with negative P&L
- **Response**: Same structure as Get All Positions

### 12. Count Positions for Current Date
- **Endpoint**: `GET /api/positions/current-date/count`
- **Description**: Get count of positions for current date
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully fetched position count for current date",
  "count": 25
}
```

### 13. Get Latest Position by Symbol
- **Endpoint**: `GET /api/positions/latest-by-symbol/<symbol>`
- **Description**: Get the most recent position record for a symbol
- **URL Parameters**:
  - `symbol`: Trading symbol
- **Response**: Same structure as Get All Positions (single record)

---

## LATEST RECORD Operations (For handling multiple updates per day)

### 14. Get Latest Positions by Date
- **Endpoint**: `GET /api/positions/latest-by-date`
- **Description**: Get the latest position record for each symbol on a specific date
- **Query Parameters**:
  - `date` (required): Date in YYYY-MM-DD format
- **Response**: Same structure as Get All Positions

### 15. Get Latest Positions for Current Date
- **Endpoint**: `GET /api/positions/latest-current-date`
- **Description**: Get the latest position record for each symbol on current date
- **Response**: Same structure as Get All Positions

### 16. Get Latest Positions for Date Range
- **Endpoint**: `GET /api/positions/latest-date-range`
- **Description**: Get the latest position record for each symbol for each date in range
- **Query Parameters**:
  - `start_date` (required): Start date in YYYY-MM-DD format
  - `end_date` (required): End date in YYYY-MM-DD format
- **Response**: Same structure as Get All Positions

### 17. Get Latest Positions by Symbol and Date Range
- **Endpoint**: `GET /api/positions/latest-by-symbol-and-date-range`
- **Description**: Get the latest position record for a symbol for each date in range
- **Query Parameters**:
  - `symbol` (required): Trading symbol
  - `start_date` (required): Start date in YYYY-MM-DD format
  - `end_date` (required): End date in YYYY-MM-DD format
- **Response**: Same structure as Get All Positions

---

## UPDATE Operations

### 18. Update Position by ID
- **Endpoint**: `PUT /api/positions/<position_id>`
- **Description**: Update an existing position record
- **URL Parameters**:
  - `position_id`: Position record ID
- **Request Body**: Partial position object with fields to update
- **Response**:
```json
{
  "status": "success",
  "message": "Position updated successfully"
}
```

---

## DELETE Operations

### 19. Delete Position by ID
- **Endpoint**: `DELETE /api/positions/<position_id>`
- **Description**: Delete a specific position record
- **URL Parameters**:
  - `position_id`: Position record ID
- **Response**:
```json
{
  "status": "success",
  "message": "Position deleted successfully"
}
```

### 20. Delete Positions by Date
- **Endpoint**: `DELETE /api/positions/delete-by-date`
- **Description**: Delete all positions for a specific date
- **Query Parameters**:
  - `date` (required): Date in YYYY-MM-DD format
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully deleted 15 positions for date 2025-08-04",
  "deleted_count": 15
}
```

### 21. Delete Positions by Symbol
- **Endpoint**: `DELETE /api/positions/delete-by-symbol/<symbol>`
- **Description**: Delete all positions for a specific trading symbol
- **URL Parameters**:
  - `symbol`: Trading symbol
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully deleted 8 positions for symbol NIFTY25AUG25000CE",
  "deleted_count": 8
}
```

---

## SUMMARY Operations

### 22. Get Position Summary by Symbol
- **Endpoint**: `GET /api/positions/summary/by-symbol`
- **Description**: Get aggregated position statistics by trading symbol (all records)
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully fetched position summary for 12 symbols",
  "data": [
    {
      "tradingsymbol": "NIFTY25AUG25000CE",
      "total_quantity": 500,
      "total_pnl": 1250.00,
      "avg_pnl": 125.00,
      "max_pnl": 300.00,
      "min_pnl": -50.00,
      "total_trades": 10,
      "profitable_trades": 8,
      "loss_trades": 2,
      "last_price": 105.50,
      "last_update": "2025-08-04T15:30:00+00:00"
    }
  ],
  "count": 12
}
```

### 23. Get Daily P&L Summary
- **Endpoint**: `GET /api/positions/summary/daily-pnl`
- **Description**: Get daily aggregated P&L statistics (all records)
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully fetched daily P&L summary for 30 days",
  "data": [
    {
      "trade_date": "2025-08-04",
      "total_pnl": 2500.00,
      "profitable_positions": 15,
      "loss_positions": 5,
      "total_trades": 20,
      "avg_pnl": 125.00,
      "max_pnl": 500.00,
      "min_pnl": -100.00,
      "total_profit": 3000.00,
      "total_loss": -500.00
    }
  ],
  "count": 30
}
```

### 24. Get Position Summary by Date (Latest Records)
- **Endpoint**: `GET /api/positions/summary/by-date-latest`
- **Description**: Get daily position summary using only latest records per symbol per date
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully fetched position summary by date for 30 days (latest records)",
  "data": [
    {
      "trade_date": "2025-08-04",
      "unique_symbols": 12,
      "symbol_count": 12,
      "total_pnl": 2500.00,
      "avg_pnl": 208.33,
      "min_pnl": -100.00,
      "max_pnl": 500.00,
      "total_profit": 3000.00,
      "total_loss": -500.00,
      "profitable_positions": 10,
      "loss_positions": 2,
      "total_quantity": 1500,
      "total_abs_quantity": 1500
    }
  ],
  "count": 30
}
```

### 25. Get Position Summary by Symbol (Latest Records)
- **Endpoint**: `GET /api/positions/summary/by-symbol-latest`
- **Description**: Get current position status using only the latest record for each symbol
- **Response**:
```json
{
  "status": "success",
  "message": "Successfully fetched latest position summary for 12 symbols",
  "data": [
    {
      "tradingsymbol": "NIFTY25AUG25000CE",
      "last_update": "2025-08-04T15:30:00+00:00",
      "current_pnl": 250.00,
      "current_quantity": 50,
      "last_price": 105.50,
      "product": "MIS",
      "exchange": "NSE",
      "position_status": "PROFIT"
    }
  ],
  "count": 12
}
```

---

## HEALTH CHECK

### 26. Health Check
- **Endpoint**: `GET /api/positions/health`
- **Description**: Check if the Position API is healthy and responsive
- **Response**:
```json
{
  "status": "success",
  "message": "Position Utilities API is healthy",
  "timestamp": "2025-08-04T15:30:00.123456"
}
```

---

## Error Response Structure

All endpoints return the following structure for errors:

```json
{
  "status": "error",
  "message": "Error description here"
}
```

HTTP Status Codes:
- `200`: Success
- `400`: Bad Request (missing required parameters)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## Key Features

### Latest Record Logic
Many endpoints support "latest record" functionality to handle multiple position updates throughout the day. This is crucial for:
- Getting the final state of positions at end of day
- Avoiding duplicate counting in summaries
- Accurate P&L calculations

### Date Handling
- All dates should be in `YYYY-MM-DD` format
- Timestamps are returned in ISO format with timezone
- Current date endpoints use server's current date

### Filtering & Pagination
- Support for limit/offset pagination where applicable
- Multiple filtering options (date, symbol, P&L range)
- Efficient SQL queries with proper indexing

### Data Validation
- Required parameter validation
- Date format validation
- Type checking for numeric fields
