#!/usr/bin/env python3
import subprocess
import os

os.chdir('/vercel/share/v0-project')

# Get current git status
print("Current branch and status:")
result = subprocess.run(['git', 'status'], capture_output=True, text=True)
print(result.stdout)

# Reset hard to origin
print("\nResetting to origin...")
result = subprocess.run(['git', 'reset', '--hard', 'origin/main'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

# Clean untracked files
print("\nCleaning untracked files...")
result = subprocess.run(['git', 'clean', '-fd'], capture_output=True, text=True)
print(result.stdout)

print("\nDone! Project restored.")
