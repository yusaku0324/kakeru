
set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <csv_file>"
    exit 1
fi

CSV_FILE=$1
TODAY=$(date +%Y-%m-%d)

echo "=== TwExport CSV to X Queue Workflow ==="
echo "CSV File: $CSV_FILE"
echo "Date: $TODAY"
echo

mkdir -p drafts knowledge queue

echo "Step 1: Converting CSV to Markdown..."
python bot/csv_to_markdown.py "$CSV_FILE"
echo "✅ Markdown file created: drafts/$TODAY.md"
echo

echo "Step 2: Converting Markdown to Queue..."
python bot/md2queue.py
echo "✅ Queue file created: queue/queue_$TODAY.json"
echo

echo "=== Results ==="
echo "Markdown file: drafts/$TODAY.md"
echo "Queue file: queue/queue_$TODAY.json"
echo

if command -v jq &> /dev/null; then
    echo "Total posts in queue: $(jq length queue/queue_$TODAY.json)"
    
    echo "Job posts: $(jq '[.[] | select(.text | contains("#メンエス求人"))] | length' queue/queue_$TODAY.json)"
    echo "Q&A posts: $(jq '[.[] | select(.text | contains("#メンエスQ&A"))] | length' queue/queue_$TODAY.json)"
else
    echo "jq not installed. Install with: sudo apt-get install jq"
    echo "Total posts in queue: $(grep -o '"text":' queue/queue_$TODAY.json | wc -l)"
fi
echo

echo "Workflow completed successfully!"
