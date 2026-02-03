---
name: data-analysis
description: Data analysis with Python using pandas, numpy, and visualization libraries. Use when analyzing datasets, generating statistics, or creating charts.
metadata:
  author: iker-agents
  version: "1.0"
---

# Data Analysis Skill

Follow these guidelines when performing data analysis.

## Loading Data

```python
import pandas as pd
import numpy as np

# From CSV
df = pd.read_csv("data.csv")

# From JSON
df = pd.read_json("data.json")

# Quick inspection
print(df.head())
print(df.info())
print(df.describe())
```

## Data Cleaning

### Handle missing values

```python
# Check for nulls
df.isnull().sum()

# Fill with mean/median
df["column"] = df["column"].fillna(df["column"].mean())

# Drop rows with nulls
df = df.dropna(subset=["important_column"])
```

### Fix data types

```python
# Convert types
df["date"] = pd.to_datetime(df["date"])
df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
df["category"] = df["category"].astype("category")
```

## Analysis Patterns

### Group and aggregate

```python
# Group by category
summary = df.groupby("category").agg({
    "amount": ["sum", "mean", "count"],
    "quantity": "sum"
})

# Pivot table
pivot = pd.pivot_table(
    df,
    values="amount",
    index="category",
    columns="month",
    aggfunc="sum"
)
```

### Time series

```python
# Set datetime index
df = df.set_index("date")

# Resample to monthly
monthly = df.resample("M").sum()

# Rolling average
df["rolling_avg"] = df["value"].rolling(window=7).mean()
```

## Visualization

### Basic plots with matplotlib

```python
import matplotlib.pyplot as plt

# Line chart
plt.figure(figsize=(10, 6))
plt.plot(df["date"], df["value"])
plt.title("Value Over Time")
plt.xlabel("Date")
plt.ylabel("Value")
plt.savefig("chart.png")
plt.close()
```

### Statistical visualization

```python
# Histogram
df["amount"].hist(bins=30)

# Box plot
df.boxplot(column="amount", by="category")

# Scatter plot
df.plot.scatter(x="x_col", y="y_col", c="category", colormap="viridis")
```

## Statistical Analysis

```python
from scipy import stats

# Descriptive statistics
mean = df["value"].mean()
std = df["value"].std()
median = df["value"].median()

# Correlation
correlation = df[["col1", "col2"]].corr()

# T-test
t_stat, p_value = stats.ttest_ind(group1, group2)
```

## Large Dataset Pattern (File-Based Analysis)

When working with large datasets, save results to files and use shell commands
to query them. This keeps context lean and avoids loading everything into memory.

### Step 1: Generate and save data to file

```python
import json
import random
from datetime import datetime, timedelta

# Generate mock sales data
categories = ["Electronics", "Clothing", "Food", "Home", "Sports"]
regions = ["North", "South", "East", "West"]

data = []
base_date = datetime(2024, 1, 1)
for i in range(10000):
    data.append({
        "id": i + 1,
        "date": (base_date + timedelta(days=random.randint(0, 365))).isoformat(),
        "category": random.choice(categories),
        "region": random.choice(regions),
        "amount": round(random.uniform(10, 500), 2),
        "quantity": random.randint(1, 20),
        "customer_id": f"CUST-{random.randint(1000, 9999)}"
    })

# Save to file (DON'T return to context)
with open("/tmp/sales_data.json", "w") as f:
    for record in data:
        f.write(json.dumps(record) + "\n")

print(f"Saved {len(data)} records to /tmp/sales_data.json")
```

### Step 2: Query with shell commands (executeCommand)

Use `executeCommand` to run shell commands on the saved data:

```json
{
  "action": {
    "type": "executeCommand",
    "command": "grep 'Electronics' /tmp/sales_data.json | head -5"
  }
}
```

### Common shell patterns for data analysis

```bash
# Count records by category
grep -o '"category":"[^"]*"' /tmp/sales_data.json | sort | uniq -c

# Find high-value transactions (amount > 400)
grep -E '"amount":4[0-9]{2}' /tmp/sales_data.json | wc -l

# Get unique customer IDs
grep -o '"customer_id":"[^"]*"' /tmp/sales_data.json | sort -u | wc -l

# Filter by region and calculate with jq
cat /tmp/sales_data.json | jq -s '[.[] | select(.region=="North")] | length'

# Sample 10 random records
shuf -n 10 /tmp/sales_data.json

# Get records for a specific date range
grep '"date":"2024-06' /tmp/sales_data.json | wc -l
```

### Step 3: Process subsets in Python

```python
import json

# Read only filtered data for detailed analysis
with open("/tmp/filtered_results.json", "r") as f:
    subset = [json.loads(line) for line in f]

# Now analyze the smaller subset
total = sum(r["amount"] for r in subset)
avg = total / len(subset)
print(f"Subset analysis: {len(subset)} records, total=${total:.2f}, avg=${avg:.2f}")
```

### Workflow Summary

1. **Generate/Load** → Save raw data to `/tmp/data.json`
2. **Filter** → Use `grep`, `jq`, `awk` to create subsets
3. **Analyze** → Load only the subset needed into Python
4. **Output** → Save results to files, return only summary to context

This pattern keeps your context window free for reasoning while handling
datasets of any size.

## Best Practices

1. **Always inspect data first** - Use `.head()`, `.info()`, `.describe()`
2. **Handle missing data explicitly** - Document your strategy
3. **Use appropriate data types** - Saves memory and prevents errors
4. **Validate results** - Sanity check aggregations and statistics
5. **Save intermediate results** - Use checkpoints for large datasets
6. **Keep context lean** - Write large data to files, use shell to query
