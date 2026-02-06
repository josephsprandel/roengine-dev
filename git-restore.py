#!/usr/bin/env python3
import subprocess
import os

os.chdir('/vercel/share/v0-project')

# Reset all changes
result = subprocess.run(['git', 'reset', '--hard', 'HEAD'], capture_output=True, text=True)
print("Git reset output:")
print(result.stdout)
print(result.stderr)

# Clean untracked files
result2 = subprocess.run(['git', 'clean', '-fd'], capture_output=True, text=True)
print("\nGit clean output:")
print(result2.stdout)
print(result2.stderr)

print("\nRepository restored to original state")
