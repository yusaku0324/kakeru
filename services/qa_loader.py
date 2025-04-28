"""
CSV to Queue YAML Generator

This module provides functionality to convert CSV files containing questions
to queue YAML files for the Figma banner generation system.
"""
import argparse
import csv
import logging
import os
import random
import sys
from datetime import datetime
from typing import Dict, List, Optional, Union

import yaml

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def read_csv(csv_path: str, question_column: str = "投稿内容") -> List[Dict[str, str]]:
    """
    Read questions from a CSV file.

    Args:
        csv_path: Path to the CSV file
        question_column: Name of the column containing the questions

    Returns:
        List of dictionaries containing the questions
    """
    if not os.path.exists(csv_path):
        logger.error(f"CSV file not found: {csv_path}")
        return []

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            if question_column not in reader.fieldnames:
                potential_columns = ["prompt", "text", "question", "content", "投稿内容"]
                for col in potential_columns:
                    if col in reader.fieldnames:
                        logger.warning(
                            f"Column '{question_column}' not found, using '{col}' instead"
                        )
                        question_column = col
                        break
                else:
                    logger.error(f"No suitable question column found in CSV")
                    return []
            
            rows = list(reader)
            
            logger.info(f"Read {len(rows)} rows from {csv_path}")
            return rows
    except Exception as e:
        logger.error(f"Error reading CSV file: {e}")
        return []


def extract_questions(rows: List[Dict[str, str]], question_column: str = "投稿内容") -> List[str]:
    """
    Extract questions from CSV rows.

    Args:
        rows: List of dictionaries containing the CSV rows
        question_column: Name of the column containing the questions

    Returns:
        List of questions
    """
    questions = []
    
    for row in rows:
        if question_column in row and row[question_column]:
            question_text = row[question_column].strip().split("\n")[0]
            
            prefixes = ["Q:", "Q：", "質問:", "質問："]
            for prefix in prefixes:
                if question_text.startswith(prefix):
                    question_text = question_text[len(prefix):].strip()
                    break
            
            if question_text:
                questions.append(question_text)
    
    logger.info(f"Extracted {len(questions)} questions")
    return questions


def to_queue(
    questions: List[str],
    shuffle: bool = False,
    limit: Optional[int] = None,
) -> List[Dict[str, str]]:
    """
    Convert questions to queue format.

    Args:
        questions: List of questions
        shuffle: Whether to shuffle the questions
        limit: Maximum number of questions to include

    Returns:
        List of dictionaries in queue format
    """
    queue_items = [{"text": q} for q in questions]
    
    if shuffle:
        random.shuffle(queue_items)
    
    if limit is not None and limit > 0:
        queue_items = queue_items[:limit]
    
    logger.info(f"Created queue with {len(queue_items)} items")
    return queue_items


def write_yaml(queue_items: List[Dict[str, str]], output_path: str) -> bool:
    """
    Write queue items to a YAML file.

    Args:
        queue_items: List of dictionaries in queue format
        output_path: Path to the output YAML file

    Returns:
        True if successful, False otherwise
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            yaml.dump(queue_items, f, default_flow_style=False, allow_unicode=True)
        
        logger.info(f"Wrote {len(queue_items)} items to {output_path}")
        return True
    except Exception as e:
        logger.error(f"Error writing YAML file: {e}")
        return False


def main():
    """
    Main entry point for the CLI.
    """
    parser = argparse.ArgumentParser(description="Convert CSV to queue YAML")
    parser.add_argument("--csv", required=True, help="Path to the input CSV file")
    parser.add_argument("--out", required=True, help="Path to the output YAML file")
    parser.add_argument(
        "--question-column", default="投稿内容", help="Name of the column containing the questions"
    )
    parser.add_argument(
        "--shuffle", action="store_true", help="Shuffle the questions"
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="Maximum number of questions to include"
    )
    
    args = parser.parse_args()
    
    rows = read_csv(args.csv, args.question_column)
    if not rows:
        logger.error("No rows found in CSV file")
        return 1
    
    questions = extract_questions(rows, args.question_column)
    if not questions:
        logger.error("No questions found in CSV file")
        return 1
    
    queue_items = to_queue(questions, args.shuffle, args.limit)
    
    success = write_yaml(queue_items, args.out)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
