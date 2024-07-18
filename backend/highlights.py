import logging
import os
from collections import defaultdict

from github import Github

logging.basicConfig(level=logging.INFO)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise ValueError("GITHUB_TOKEN environment variable is not set")

REPOSITORY_NAME = "aws-samples/bedrock-claude-chat"

EXCLUDED_USERS = ["statefb", "wadabee", "Yukinobu-Mine"]  # Core maintainers


def calculate_score(stats):
    # Calculate score based on lines changed and number of PRs
    WEIGHT_LINES_CHANGED = 0.7
    WEIGHT_PRS = 1000
    return stats["lines_changed"] * WEIGHT_LINES_CHANGED + stats["prs"] * WEIGHT_PRS


g = Github(GITHUB_TOKEN)
repo = g.get_repo(REPOSITORY_NAME)

contributors = defaultdict(lambda: {"lines_changed": 0, "prs": 0})

logging.info("Fetching commits...")
commits = repo.get_commits()
commit_count = 0
for commit in commits:
    if commit.author:
        stats = commit.stats
        contributors[commit.author.login]["lines_changed"] += (
            stats.additions + stats.deletions
        )
    commit_count += 1
    if commit_count % 100 == 0:
        logging.info(f"Processed {commit_count} commits...")

logging.info("Fetching pull requests...")
prs = repo.get_pulls(state="closed", sort="created", direction="desc")
pr_count = 0
for pr in prs:
    if pr.merged and pr.user:
        contributors[pr.user.login]["prs"] += 1
    pr_count += 1
    if pr_count % 10 == 0:
        logging.info(f"Processed {pr_count} pull requests...")

logging.info(f"Total pull requests processed: {pr_count}")

logging.info(f"Total contributors: {len(contributors)}")


logging.info("Calculating contributor scores...")
highlighted_contributors = sorted(
    contributors.items(), key=lambda x: calculate_score(x[1]), reverse=True
)

logging.info(f"Top 20 contributors: {highlighted_contributors[:20]}")

PLATINUM_THRESHOLD = 40000

platinum_contributors = [
    (username, calculate_score(stats))
    for username, stats in highlighted_contributors
    if calculate_score(stats) >= PLATINUM_THRESHOLD and username not in EXCLUDED_USERS
]

logging.info(f"Platinum contributors: {platinum_contributors}")

platinum_icon = "🏆"

platinum_md = f"## {platinum_icon} Significant Contributors\n" + "\n".join(
    [
        f"- [{username}](https://github.com/{username})"
        for username, score in platinum_contributors
    ]
)
