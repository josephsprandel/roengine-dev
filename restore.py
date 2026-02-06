#!/usr/bin/env python3
import subprocess
import os

# Change to the correct working directory
os.chdir('/vercel/share/v0-project')

# Run git reset --hard to discard all changes
result1 = subprocess.run(['git', 'reset', '--hard'], capture_output=True, text=True)
print("Git reset output:", result1.stdout)
print("Git reset errors:", result1.stderr)

# Run git clean to remove untracked files
result2 = subprocess.run(['git', 'clean', '-fd'], capture_output=True, text=True)
print("Git clean output:", result2.stdout)
print("Git clean errors:", result2.stderr)

print("Restoration complete!")
