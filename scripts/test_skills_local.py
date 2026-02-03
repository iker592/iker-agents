#!/usr/bin/env python3
"""Test the skills system locally without AWS.

This tests the skills loading mechanism works correctly.
"""

import sys
from pathlib import Path

# Add agents to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.coding.skills_loader import (
    discover_skills,
    generate_skills_xml,
    list_skills,
    load_skill,
    read_skill_file,
)


def main():
    print("=" * 50)
    print("Testing Skills Loader")
    print("=" * 50)

    # Test discover_skills
    print("\n1. Discovering skills...")
    skills = discover_skills()
    print(f"   Found {len(skills)} skills:")
    for s in skills:
        print(f"   - {s.name}: {s.description[:50]}...")

    # Test generate_skills_xml
    print("\n2. Generating XML...")
    xml = generate_skills_xml(skills)
    print(f"   Generated {len(xml)} chars of XML")
    print("   Preview:")
    for line in xml.split("\n")[:8]:
        print(f"   {line}")

    # Test list_skills tool
    print("\n3. Testing list_skills tool...")
    result = list_skills()
    print(f"   Status: {result['status']}")
    print(f"   Skills: {result['total']}")

    # Test load_skill tool
    print("\n4. Testing load_skill tool...")
    result = load_skill("data-analysis")
    if result["status"] == "success":
        print(f"   Loaded: {result['skill_name']}")
        print(f"   Instructions length: {len(result['instructions'])} chars")
        # Check for our new file-based pattern
        if "executeCommand" in result["instructions"]:
            print("   ✅ Contains file-based analysis pattern!")
        if "grep" in result["instructions"]:
            print("   ✅ Contains shell command examples!")
    else:
        print(f"   Error: {result['error']}")

    # Test read_skill_file tool
    print("\n5. Testing read_skill_file tool...")
    result = read_skill_file("data-analysis", "shell_commands.md")
    if result["status"] == "success":
        print(f"   ✅ Read {result['file_path']}")
        print(f"   Content length: {len(result['content'])} chars")
    else:
        print(f"   Error: {result['error']}")

    result = read_skill_file("data-analysis", "generate_mock_data.py")
    if result["status"] == "success":
        print(f"   ✅ Read {result['file_path']}")
        print(f"   Content length: {len(result['content'])} chars")
    else:
        print(f"   Error: {result['error']}")

    # Test error handling
    print("\n6. Testing error handling...")
    result = load_skill("nonexistent-skill")
    if result["status"] == "error":
        print("   ✅ Correctly returned error for missing skill")
    else:
        print("   ❌ Should have returned error")

    result = read_skill_file("data-analysis", "../../../etc/passwd")
    if result["status"] == "error":
        print("   ✅ Correctly blocked path traversal attempt")
    else:
        print("   ❌ Should have blocked path traversal")

    print("\n" + "=" * 50)
    print("Skills system test complete!")
    print("=" * 50)


if __name__ == "__main__":
    main()
