"""
Tests for the CSV to Queue YAML Generator
"""
import os
import tempfile
import unittest
from unittest.mock import patch, mock_open

import yaml

from services.qa_loader import (
    read_csv,
    extract_questions,
    to_queue,
    write_yaml,
    main,
)


class TestCSVToQueue(unittest.TestCase):
    """Test cases for the CSV to Queue YAML Generator"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_csv_content = (
            "id,投稿内容,動画ファイルパス\n"
            '1,"メンエスQ&A\n「個室マッサージって風営法許可いるの？」→ 個室マッサージは風営法の対象となりますが、性的サービスを提供しない限り「届出制」となります。詳細は各自治体の規定を確認してください。\n✅ 確認済み情報",,\n'
            '2,"よくある質問：\nQ：出稼ぎの交通費支給って本当？\nA：店舗によりますが、多くの高級店では交通費の全額または一部を支給しています。事前に確認することをお勧めします。\n✅ 公式情報",,\n'
            '3,"メンエス求人に関する質問：\n未経験でも稼げますか？\n→ はい、多くの店舗では未経験者向けの研修制度があり、技術を身につけながら稼ぐことができます。\n✅ 確認済み",,'
        )
        
        self.test_csv_path = tempfile.mktemp(suffix=".csv")
        with open(self.test_csv_path, "w", encoding="utf-8") as f:
            f.write(self.test_csv_content)
        
        self.test_yaml_path = tempfile.mktemp(suffix=".yaml")
    
    def tearDown(self):
        """Tear down test fixtures"""
        if os.path.exists(self.test_csv_path):
            os.unlink(self.test_csv_path)
        
        if os.path.exists(self.test_yaml_path):
            os.unlink(self.test_yaml_path)
    
    def test_read_csv(self):
        """Test reading a CSV file"""
        rows = read_csv(self.test_csv_path)
        
        self.assertEqual(len(rows), 3)
        self.assertIn("投稿内容", rows[0])
        self.assertTrue(rows[0]["投稿内容"].startswith("メンエスQ&A"))
    
    def test_read_csv_nonexistent_file(self):
        """Test reading a nonexistent CSV file"""
        rows = read_csv("/nonexistent/file.csv")
        
        self.assertEqual(len(rows), 0)
    
    def test_read_csv_with_different_column(self):
        """Test reading a CSV file with a different column name"""
        test_csv_content = (
            "id,prompt,completion\n"
            '1,"メンズエステで働くメリットは何でしょうか？","メンズエステで働く主なメリットは、高収入が見込めること、自分のペースで働けること、そして接客スキルが身につくことです。"\n'
            '2,"未経験でも稼げるのでしょうか？","はい、未経験でも十分稼ぐことができます。多くのサロンでは研修制度が充実しており、基本的な技術やマナーをしっかり教えてもらえます。"'
        )
        
        test_csv_path = tempfile.mktemp(suffix=".csv")
        with open(test_csv_path, "w", encoding="utf-8") as f:
            f.write(test_csv_content)
        
        try:
            rows = read_csv(test_csv_path, "prompt")
            
            self.assertEqual(len(rows), 2)
            self.assertIn("prompt", rows[0])
            self.assertTrue(rows[0]["prompt"].startswith("メンズエステで働くメリット"))
        finally:
            if os.path.exists(test_csv_path):
                os.unlink(test_csv_path)
    
    def test_extract_questions(self):
        """Test extracting questions from CSV rows"""
        rows = read_csv(self.test_csv_path)
        questions = extract_questions(rows)
        
        self.assertEqual(len(questions), 3)
        self.assertTrue(questions[0].startswith("メンエスQ&A"))
        self.assertTrue(questions[1].startswith("よくある質問："))
        self.assertTrue(questions[2].startswith("メンエス求人に関する質問："))
    
    def test_extract_questions_with_prefixes(self):
        """Test extracting questions with prefixes"""
        rows = [
            {"投稿内容": "Q: これは質問ですか？"},
            {"投稿内容": "質問: これは別の質問ですか？"},
            {"投稿内容": "普通の文章です。"},
        ]
        
        questions = extract_questions(rows)
        
        self.assertEqual(len(questions), 3)
        self.assertEqual(questions[0], "これは質問ですか？")
        self.assertEqual(questions[1], "これは別の質問ですか？")
        self.assertEqual(questions[2], "普通の文章です。")
    
    def test_to_queue(self):
        """Test converting questions to queue format"""
        questions = [
            "メンエスで働くメリットは何ですか？",
            "未経験でも稼げますか？",
            "出稼ぎの交通費は支給されますか？",
        ]
        
        queue_items = to_queue(questions)
        
        self.assertEqual(len(queue_items), 3)
        self.assertEqual(queue_items[0]["text"], "メンエスで働くメリットは何ですか？")
        self.assertEqual(queue_items[1]["text"], "未経験でも稼げますか？")
        self.assertEqual(queue_items[2]["text"], "出稼ぎの交通費は支給されますか？")
    
    def test_to_queue_with_shuffle(self):
        """Test converting questions to queue format with shuffle"""
        questions = [
            "メンエスで働くメリットは何ですか？",
            "未経験でも稼げますか？",
            "出稼ぎの交通費は支給されますか？",
        ]
        
        with patch("random.shuffle") as mock_shuffle:
            queue_items = to_queue(questions, shuffle=True)
            
            self.assertEqual(len(queue_items), 3)
            mock_shuffle.assert_called_once()
    
    def test_to_queue_with_limit(self):
        """Test converting questions to queue format with limit"""
        questions = [
            "メンエスで働くメリットは何ですか？",
            "未経験でも稼げますか？",
            "出稼ぎの交通費は支給されますか？",
        ]
        
        queue_items = to_queue(questions, limit=2)
        
        self.assertEqual(len(queue_items), 2)
        self.assertEqual(queue_items[0]["text"], "メンエスで働くメリットは何ですか？")
        self.assertEqual(queue_items[1]["text"], "未経験でも稼げますか？")
    
    def test_write_yaml(self):
        """Test writing queue items to a YAML file"""
        queue_items = [
            {"text": "メンエスで働くメリットは何ですか？"},
            {"text": "未経験でも稼げますか？"},
            {"text": "出稼ぎの交通費は支給されますか？"},
        ]
        
        success = write_yaml(queue_items, self.test_yaml_path)
        
        self.assertTrue(success)
        self.assertTrue(os.path.exists(self.test_yaml_path))
        
        with open(self.test_yaml_path, "r", encoding="utf-8") as f:
            loaded_items = yaml.safe_load(f)
        
        self.assertEqual(len(loaded_items), 3)
        self.assertEqual(loaded_items[0]["text"], "メンエスで働くメリットは何ですか？")
        self.assertEqual(loaded_items[1]["text"], "未経験でも稼げますか？")
        self.assertEqual(loaded_items[2]["text"], "出稼ぎの交通費は支給されますか？")
    
    @patch("sys.argv", ["qa_loader.py", "--csv", "test.csv", "--out", "test.yaml"])
    @patch("services.qa_loader.read_csv")
    @patch("services.qa_loader.extract_questions")
    @patch("services.qa_loader.to_queue")
    @patch("services.qa_loader.write_yaml")
    def test_main_success(self, mock_write, mock_to_queue, mock_extract, mock_read):
        """Test the main function with successful execution"""
        mock_read.return_value = [{"投稿内容": "テスト質問"}]
        mock_extract.return_value = ["テスト質問"]
        mock_to_queue.return_value = [{"text": "テスト質問"}]
        mock_write.return_value = True
        
        result = main()
        self.assertEqual(result, 0)
        
        mock_read.assert_called_once()
        mock_extract.assert_called_once()
        mock_to_queue.assert_called_once()
        mock_write.assert_called_once()
    
    @patch("sys.argv", ["qa_loader.py", "--csv", "test.csv", "--out", "test.yaml", "--shuffle", "--limit", "10"])
    @patch("services.qa_loader.read_csv")
    @patch("services.qa_loader.extract_questions")
    @patch("services.qa_loader.to_queue")
    @patch("services.qa_loader.write_yaml")
    def test_main_with_options(self, mock_write, mock_to_queue, mock_extract, mock_read):
        """Test the main function with all options"""
        mock_read.return_value = [{"投稿内容": "テスト質問"}]
        mock_extract.return_value = ["テスト質問"]
        mock_to_queue.return_value = [{"text": "テスト質問"}]
        mock_write.return_value = True
        
        result = main()
        self.assertEqual(result, 0)
        
        mock_read.assert_called_once()
        mock_extract.assert_called_once()
        mock_to_queue.assert_called_once_with(["テスト質問"], True, 10)
        mock_write.assert_called_once()
    
    @patch("sys.argv", ["qa_loader.py", "--csv", "test.csv", "--out", "test.yaml"])
    @patch("services.qa_loader.read_csv")
    def test_main_no_rows(self, mock_read):
        """Test the main function with no rows in the CSV file"""
        mock_read.return_value = []
        
        result = main()
        self.assertEqual(result, 1)
    
    @patch("sys.argv", ["qa_loader.py", "--csv", "test.csv", "--out", "test.yaml"])
    @patch("services.qa_loader.read_csv")
    @patch("services.qa_loader.extract_questions")
    def test_main_no_questions(self, mock_extract, mock_read):
        """Test the main function with no questions extracted"""
        mock_read.return_value = [{"投稿内容": ""}]
        mock_extract.return_value = []
        
        result = main()
        self.assertEqual(result, 1)
    
    @patch("sys.argv", ["qa_loader.py", "--csv", "test.csv", "--out", "test.yaml"])
    @patch("services.qa_loader.read_csv")
    @patch("services.qa_loader.extract_questions")
    @patch("services.qa_loader.to_queue")
    @patch("services.qa_loader.write_yaml")
    def test_main_write_failure(self, mock_write, mock_to_queue, mock_extract, mock_read):
        """Test the main function with write failure"""
        mock_read.return_value = [{"投稿内容": "テスト質問"}]
        mock_extract.return_value = ["テスト質問"]
        mock_to_queue.return_value = [{"text": "テスト質問"}]
        mock_write.return_value = False
        
        result = main()
        self.assertEqual(result, 1)


if __name__ == "__main__":
    unittest.main()
