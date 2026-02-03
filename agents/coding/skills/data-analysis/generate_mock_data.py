#!/usr/bin/env python3
"""Generate mock sales data for data analysis examples.

This script generates sample data that can be used to test the
file-based analysis pattern where data is saved to files and
queried with shell commands.

Usage (in code_interpreter):
    exec(open('/path/to/generate_mock_data.py').read())
"""

import json
import random
from datetime import datetime, timedelta

CATEGORIES = ["Electronics", "Clothing", "Food", "Home", "Sports"]
REGIONS = ["North", "South", "East", "West"]
PRODUCTS = {
    "Electronics": ["Laptop", "Phone", "Tablet", "Headphones", "Camera"],
    "Clothing": ["Shirt", "Pants", "Jacket", "Shoes", "Hat"],
    "Food": ["Coffee", "Snacks", "Beverages", "Organic", "Frozen"],
    "Home": ["Furniture", "Decor", "Kitchen", "Bedding", "Storage"],
    "Sports": ["Shoes", "Equipment", "Apparel", "Accessories", "Outdoor"],
}


def generate_sales_data(
    num_records: int = 10000, output_path: str = "/tmp/sales_data.json"
):
    """Generate mock sales data and save to file."""
    random.seed(42)  # Reproducible
    base_date = datetime(2024, 1, 1)

    with open(output_path, "w") as f:
        for i in range(num_records):
            category = random.choice(CATEGORIES)
            record = {
                "id": i + 1,
                "date": (base_date + timedelta(days=random.randint(0, 365))).strftime(
                    "%Y-%m-%d"
                ),
                "category": category,
                "product": random.choice(PRODUCTS[category]),
                "region": random.choice(REGIONS),
                "amount": round(random.uniform(10, 500), 2),
                "quantity": random.randint(1, 20),
                "customer_id": f"CUST-{random.randint(1000, 9999)}",
            }
            f.write(json.dumps(record) + "\n")

    print(f"Generated {num_records} records -> {output_path}")
    return output_path


def generate_customer_data(
    num_customers: int = 1000, output_path: str = "/tmp/customers.json"
):
    """Generate mock customer data."""
    random.seed(43)
    tiers = ["Bronze", "Silver", "Gold", "Platinum"]

    with open(output_path, "w") as f:
        for i in range(num_customers):
            record = {
                "customer_id": f"CUST-{1000 + i}",
                "name": f"Customer {i + 1}",
                "email": f"customer{i + 1}@example.com",
                "tier": random.choice(tiers),
                "lifetime_value": round(random.uniform(100, 10000), 2),
                "signup_date": (
                    datetime(2020, 1, 1) + timedelta(days=random.randint(0, 1500))
                ).strftime("%Y-%m-%d"),
            }
            f.write(json.dumps(record) + "\n")

    print(f"Generated {num_customers} customers -> {output_path}")
    return output_path


if __name__ == "__main__":
    generate_sales_data()
    generate_customer_data()
    print("\nExample queries:")
    print("  grep 'Electronics' /tmp/sales_data.json | head -3")
    print("  grep -o '\"category\":\"[^\"]*\"' /tmp/sales_data.json | sort | uniq -c")
    print("  grep 'Gold' /tmp/customers.json | wc -l")
