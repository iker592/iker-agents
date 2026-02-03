# Shell Commands for Data Analysis

Quick reference for analyzing JSON-lines data files using shell commands.
Use with `executeCommand` action in code_interpreter.

## Counting & Filtering

```bash
# Count total records
wc -l /tmp/data.json

# Count records matching pattern
grep 'Electronics' /tmp/sales_data.json | wc -l

# Filter and save subset
grep 'North' /tmp/sales_data.json > /tmp/north_sales.json
```

## Field Extraction

```bash
# Extract unique values of a field
grep -o '"category":"[^"]*"' /tmp/sales_data.json | sort -u

# Count by field value
grep -o '"category":"[^"]*"' /tmp/sales_data.json | sort | uniq -c | sort -rn

# Extract specific field with jq
cat /tmp/sales_data.json | jq -r '.category' | sort | uniq -c
```

## Numeric Analysis

```bash
# Sum amounts with awk
cat /tmp/sales_data.json | jq -r '.amount' | awk '{sum+=$1} END {print sum}'

# Average
cat /tmp/sales_data.json | jq -r '.amount' | awk '{sum+=$1; n++} END {print sum/n}'

# Min/Max
cat /tmp/sales_data.json | jq -r '.amount' | sort -n | head -1  # min
cat /tmp/sales_data.json | jq -r '.amount' | sort -n | tail -1  # max
```

## Sampling

```bash
# Random sample of N records
shuf -n 100 /tmp/sales_data.json > /tmp/sample.json

# First/Last N records
head -10 /tmp/sales_data.json
tail -10 /tmp/sales_data.json

# Every Nth record
awk 'NR % 100 == 0' /tmp/sales_data.json
```

## Date Filtering

```bash
# Records from specific month
grep '"date":"2024-06' /tmp/sales_data.json | wc -l

# Date range (requires jq)
cat /tmp/sales_data.json | jq -c 'select(.date >= "2024-06-01" and .date <= "2024-06-30")'
```

## Complex Filters with jq

```bash
# Multiple conditions
cat /tmp/sales_data.json | jq -c 'select(.category=="Electronics" and .amount > 100)'

# Aggregate by group
cat /tmp/sales_data.json | jq -s 'group_by(.category) | map({category: .[0].category, total: map(.amount) | add})'

# Top N by field
cat /tmp/sales_data.json | jq -s 'sort_by(-.amount) | .[0:5]'
```

## File Operations

```bash
# Check file size
ls -lh /tmp/sales_data.json

# List files in directory
ls -la /tmp/*.json

# Combine files
cat /tmp/file1.json /tmp/file2.json > /tmp/combined.json
```

## Performance Tips

1. Use `grep` for simple pattern matching (fastest)
2. Use `jq` for JSON-aware operations
3. Pipe through `head` to limit output
4. Save filtered results to new files for further analysis
