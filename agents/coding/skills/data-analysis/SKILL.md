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

## Best Practices

1. **Always inspect data first** - Use `.head()`, `.info()`, `.describe()`
2. **Handle missing data explicitly** - Document your strategy
3. **Use appropriate data types** - Saves memory and prevents errors
4. **Validate results** - Sanity check aggregations and statistics
5. **Save intermediate results** - Use checkpoints for large datasets
