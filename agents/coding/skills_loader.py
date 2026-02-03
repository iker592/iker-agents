"""Skills loader for agents.

Implements the Agent Skills specification (https://agentskills.io).
Skills are SKILL.md files with YAML frontmatter that provide specialized
instructions and capabilities to agents.
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from strands import tool


@dataclass
class Skill:
    """Represents a loaded skill."""

    name: str
    description: str
    instructions: str
    path: Path
    metadata: dict[str, Any] | None = None


def parse_skill_md(path: Path) -> Skill | None:
    """Parse a SKILL.md file and extract metadata and instructions.

    Args:
        path: Path to the SKILL.md file

    Returns:
        Skill object or None if parsing fails
    """
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return None

    # Extract YAML frontmatter
    frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
    if not frontmatter_match:
        return None

    try:
        frontmatter = yaml.safe_load(frontmatter_match.group(1))
        instructions = frontmatter_match.group(2).strip()
    except yaml.YAMLError:
        return None

    name = frontmatter.get("name")
    description = frontmatter.get("description")

    if not name or not description:
        return None

    return Skill(
        name=name,
        description=description,
        instructions=instructions,
        path=path,
        metadata=frontmatter.get("metadata"),
    )


def discover_skills(skills_dirs: list[Path] | None = None) -> list[Skill]:
    """Discover all available skills from configured directories.

    Args:
        skills_dirs: List of directories to search for skills.
                    Defaults to ./skills relative to this module.

    Returns:
        List of discovered skills
    """
    if skills_dirs is None:
        # Default to skills directory relative to this module
        module_dir = Path(__file__).parent
        skills_dirs = [module_dir / "skills"]

    skills = []
    for skills_dir in skills_dirs:
        if not skills_dir.exists():
            continue

        # Find all SKILL.md files
        for skill_md in skills_dir.glob("*/SKILL.md"):
            skill = parse_skill_md(skill_md)
            if skill:
                skills.append(skill)

    return skills


def generate_skills_xml(skills: list[Skill]) -> str:
    """Generate XML for system prompt injection.

    Args:
        skills: List of skills to include

    Returns:
        XML string for system prompt
    """
    if not skills:
        return ""

    lines = ["<available_skills>"]
    for skill in skills:
        lines.append("  <skill>")
        lines.append(f"    <name>{skill.name}</name>")
        lines.append(f"    <description>{skill.description}</description>")
        lines.append("  </skill>")
    lines.append("</available_skills>")
    return "\n".join(lines)


# Global skills cache
_skills_cache: dict[str, Skill] = {}


def _ensure_skills_loaded() -> None:
    """Ensure skills are loaded into cache."""
    global _skills_cache
    if not _skills_cache:
        skills = discover_skills()
        _skills_cache = {s.name: s for s in skills}


@tool
def list_skills() -> dict[str, Any]:
    """List all available skills with their names and descriptions.

    Returns a list of skills that can be loaded to get specialized instructions
    for specific tasks like Python development, data analysis, etc.

    Returns:
        Dictionary with list of available skills.
    """
    _ensure_skills_loaded()

    skills_list = [
        {"name": s.name, "description": s.description} for s in _skills_cache.values()
    ]

    return {
        "status": "success",
        "skills": skills_list,
        "total": len(skills_list),
    }


@tool
def load_skill(skill_name: str) -> dict[str, Any]:
    """Load a skill's instructions into context.

    Use this when you need specialized guidance for a specific task.
    The skill's instructions will help you perform the task more effectively.

    Args:
        skill_name: Name of the skill to load (e.g., "python-dev", "data-analysis")

    Returns:
        The skill's instructions to follow.
    """
    _ensure_skills_loaded()

    skill = _skills_cache.get(skill_name)
    if not skill:
        available = list(_skills_cache.keys())
        return {
            "status": "error",
            "error": f"Skill '{skill_name}' not found",
            "available_skills": available,
        }

    return {
        "status": "success",
        "skill_name": skill.name,
        "instructions": skill.instructions,
    }


@tool
def read_skill_file(skill_name: str, file_path: str) -> dict[str, Any]:
    """Read a supporting file from a skill's directory.

    Skills may include additional resources like scripts, references, or templates.
    Use this to access those files.

    Args:
        skill_name: Name of the skill
        file_path: Relative path to the file within the skill directory

    Returns:
        The file contents.
    """
    _ensure_skills_loaded()

    skill = _skills_cache.get(skill_name)
    if not skill:
        return {"status": "error", "error": f"Skill '{skill_name}' not found"}

    # Security: prevent path traversal
    if ".." in file_path or file_path.startswith("/"):
        return {"status": "error", "error": "Invalid file path"}

    skill_dir = skill.path.parent
    target_file = skill_dir / file_path

    if not target_file.exists():
        return {"status": "error", "error": f"File not found: {file_path}"}

    try:
        content = target_file.read_text(encoding="utf-8")
        return {
            "status": "success",
            "file_path": file_path,
            "content": content,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def get_skills_system_prompt_addition() -> str:
    """Get the skills-related addition for the system prompt.

    Returns:
        String to append to system prompt with available skills.
    """
    _ensure_skills_loaded()
    skills = list(_skills_cache.values())

    if not skills:
        return ""

    xml = generate_skills_xml(skills)
    return f"""

You have access to specialized skills with detailed instructions for specific tasks.
Use list_skills to see available skills, and load_skill to get instructions.

{xml}

When a task matches a skill's description, load that skill first for guidance.
"""
