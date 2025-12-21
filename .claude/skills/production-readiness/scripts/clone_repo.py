#!/usr/bin/env python3
"""
Clone Repository Script - Handles GitHub repository cloning with authentication and submodules
"""

import os
import sys
import argparse
import subprocess
import tempfile
from pathlib import Path


def clone_repository(url: str, output_path: str = None, depth: str = "full") -> Path:
    """Clone a GitHub repository.
    
    Args:
        url: GitHub repository URL
        output_path: Optional output directory
        depth: Clone depth - 'full', 'shallow' (100 commits), or 'minimal' (1 commit)
    
    Returns:
        Path to the cloned repository
    """
    if output_path:
        target_path = Path(output_path)
    else:
        temp_dir = tempfile.mkdtemp(prefix="prod_readiness_")
        target_path = Path(temp_dir) / "project"
    
    # Build git clone command
    cmd = ["git", "clone"]
    
    # Add depth option
    if depth == "shallow":
        cmd.extend(["--depth", "100"])
    elif depth == "minimal":
        cmd.extend(["--depth", "1"])
    
    # Add submodule handling
    cmd.append("--recurse-submodules")
    
    # Add URL and target
    cmd.extend([url, str(target_path)])
    
    print(f"Cloning repository: {url}")
    print(f"Target: {target_path}")
    print(f"Depth: {depth}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )
        
        if result.returncode != 0:
            print(f"Error cloning repository:")
            print(result.stderr)
            sys.exit(1)
        
        print(f"Successfully cloned to: {target_path}")
        
        # Get some basic info about the repo
        os.chdir(target_path)
        
        # Get branch info
        branch_result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True
        )
        print(f"Default branch: {branch_result.stdout.strip()}")
        
        # Get commit count (approximate for shallow clones)
        commit_result = subprocess.run(
            ["git", "rev-list", "--count", "HEAD"],
            capture_output=True,
            text=True
        )
        print(f"Commits (in this clone): {commit_result.stdout.strip()}")
        
        # Get latest commit
        latest_result = subprocess.run(
            ["git", "log", "-1", "--format=%H %s"],
            capture_output=True,
            text=True
        )
        print(f"Latest commit: {latest_result.stdout.strip()}")
        
        return target_path
        
    except subprocess.TimeoutExpired:
        print("Error: Repository clone timed out (10 minutes)")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Clone a GitHub repository for analysis")
    parser.add_argument("url", help="GitHub repository URL")
    parser.add_argument("--output", "-o", help="Output directory")
    parser.add_argument(
        "--depth",
        choices=["full", "shallow", "minimal"],
        default="shallow",
        help="Clone depth (default: shallow with 100 commits)"
    )
    
    args = parser.parse_args()
    
    clone_repository(args.url, args.output, args.depth)


if __name__ == "__main__":
    main()
