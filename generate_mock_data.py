import random
import datetime
import uuid

# Configuration
NUM_COMMITS = 10000
START_DATE = datetime.datetime(2022, 1, 1)
AUTHORS = [
    ("Alice", "alice@company.com"),
    ("Bob", "bob@company.com"),
    ("Charlie", "charlie@company.com"),
    ("Dave", "dave@company.com"),
    ("Eve", "eve@company.com"),
    ("Frank", "frank@company.com"),
    ("Grace", "grace@company.com"),
    ("Heidi", "heidi@company.com"),
    ("Ivan", "ivan@company.com"),
    ("Judy", "judy@company.com"),
    ("Mallory", "mallory@company.com"),
    ("Trent", "trent@company.com"),
    ("Walter", "walter@company.com"),
    ("Peggy", "peggy@company.com"),
    ("Sybil", "sybil@company.com")
]

# Realistic File Structure - Expanded
DIRS = [
    "src/components/core", "src/components/ui", "src/components/layout",
    "src/components/forms", "src/components/tables", "src/components/charts",
    "src/hooks", "src/utils", "src/services", "src/api", "src/store",
    "src/pages/dashboard", "src/pages/settings", "src/pages/users", 
    "src/pages/reports", "src/pages/auth",
    "src/styles/themes", "src/styles/mixins",
    "public/assets/images", "public/assets/icons", "public/assets/fonts",
    "tests/unit", "tests/e2e", "tests/integration",
    "docs/api", "docs/guides", "docs/architecture",
    "config", "scripts", "tools/build", "tools/deploy"
]

EXTENSIONS = {
    "src": ["ts", "tsx", "css", "scss", "less"],
    "public": ["png", "jpg", "svg", "ico", "json"],
    "tests": ["ts", "tsx", "test.ts", "spec.ts"],
    "docs": ["md", "txt"],
    "config": ["json", "js", "ts", "yml"],
    "scripts": ["js", "sh", "py", "rb"],
    "tools": ["js", "ts", "go", "rs"]
}

# Generate a pool of realistic files - Expanded
FILES = []
for d in DIRS:
    root = d.split("/")[0]
    exts = EXTENSIONS.get(root, ["txt"])
    
    # Create 10-50 files per directory for "more big"
    num_files = random.randint(10, 50)
    for i in range(num_files):
        name = f"File_{uuid.uuid4().hex[:8]}"
        ext = random.choice(exts)
        FILES.append(f"{d}/{name}.{ext}")

# Define "Features" (groups of files that are often edited together)
FEATURES = []
for _ in range(50):
    # A feature touches 5-20 files
    size = random.randint(5, 20)
    feature_files = random.sample(FILES, size)
    FEATURES.append(feature_files)

# Generate Commits
with open("git-history.txt", "w", encoding='utf-8') as f:
    current_date = START_DATE
    
    for i in range(NUM_COMMITS):
        # Advance time (highly variable)
        if random.random() < 0.05:
            # Vacation / Project Hold
            current_date += datetime.timedelta(days=random.randint(3, 14))
        elif random.random() < 0.15:
            # Weekend / Night
            current_date += datetime.timedelta(hours=random.randint(12, 48))
        else:
            # Coding burst
            current_date += datetime.timedelta(minutes=random.randint(1, 180))
            
        sha = uuid.uuid4().hex
        author = random.choice(AUTHORS)
        date_str = current_date.isoformat()
        
        # Determine commit type and impacted files
        rand_val = random.random()
        commit_type = ""
        message = f"Commit {i}: "
        impacted_files = []
        
        if rand_val < 0.4: # Feature work (40%)
            commit_type = "feat"
            feat = random.choice(FEATURES)
            # Pick subset of feature files
            k = random.randint(1, len(feat))
            impacted_files = random.sample(feat, k)
            message += f"Add feature {uuid.uuid4().hex[:4]}"
        elif rand_val < 0.7: # Fixes (30%)
            commit_type = "fix"
            # Random specific files or widespread fix
            if random.random() < 0.2:
                 k = random.randint(5, 15) # widespread
            else:
                 k = random.randint(1, 3) # targeted
            impacted_files = random.sample(FILES, k)
            message += f"Fix bug {uuid.uuid4().hex[:4]}"
        elif rand_val < 0.85: # Refactor (15%)
            commit_type = "refactor"
            # Touch many files
            k = random.randint(10, 80)
            impacted_files = random.sample(FILES, k)
            message += "Major refactoring"
        elif rand_val < 0.95: # Docs/Chore (10%)
            commit_type = "chore"
            k = random.randint(1, 5)
            impacted_files = random.sample(FILES, k)
            message += "Update docs/configs"
        else: # Merge / Release (5%)
            commit_type = "merge"
            message += f"Merge branch 'feature/{uuid.uuid4().hex[:6]}'"
            # Merges affect many files potentially
            k = random.randint(2, 20)
            impacted_files = random.sample(FILES, k)

        # Write Commit Header
        f.write(f"COMMIT|{sha}|{author[0]}|{author[1]}|{date_str}|{message}\n")
        
        # Write File Changes (Numstat format: added deleted path)
        for path in impacted_files:
            # Simulate realistic churn
            if any(path.endswith(ext) for ext in ["png", "jpg", "ico", "svg"]):
                added = "-"
                deleted = "-"
            else:
                # Pareto principle: most changes are small, some are huge
                if random.random() < 0.9:
                    added = random.randint(0, 50)
                    deleted = random.randint(0, 20)
                else:
                    added = random.randint(100, 1000)
                    deleted = random.randint(50, 500)
                
            f.write(f"{added}\t{deleted}\t{path}\n")

print(f"Generated {NUM_COMMITS} commits with {len(FILES)} unique files.")
