"""Tests for HimeDeco client."""
import pytest
from unittest.mock import Mock, MagicMock, patch
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException

from bot.services.himedeco_client.poster import HimeDecoPoster
from bot.services.himedeco_client.config import HimeDecoConfig
from bot.services.himedeco_client.main import HimeDecoClient


class TestHimeDecoPoster:
    """Test HimeDecoPoster class."""
    
    @pytest.fixture
    def mock_driver(self):
        """Create mock driver."""
        driver = Mock()
        driver.find_element = MagicMock()
        driver.find_elements = MagicMock(return_value=[])
        driver.current_url = "https://himedeco.jp/diary/entry/123"
        return driver
    
    @pytest.fixture
    def poster(self, mock_driver):
        """Create HimeDecoPoster instance."""
        return HimeDecoPoster(mock_driver)
    
    def test_login_success(self, poster, mock_driver):
        """Test successful login."""
        # Mock elements
        username_field = Mock()
        password_field = Mock()
        login_button = Mock()
        
        mock_driver.find_element.side_effect = [
            password_field,
            login_button
        ]
        
        # Mock wait
        with patch.object(poster.wait, 'until') as mock_wait:
            mock_wait.side_effect = [username_field, Mock()]  # Return username field and dashboard element
            
            result = poster.login("testuser", "testpass")
            
            assert result is True
            username_field.send_keys.assert_called_once_with("testuser")
            password_field.send_keys.assert_called_once_with("testpass")
    
    def test_login_timeout(self, poster):
        """Test login timeout."""
        with patch.object(poster.wait, 'until') as mock_wait:
            mock_wait.side_effect = TimeoutException()
            
            result = poster.login("testuser", "testpass")
            
            assert result is False
    
    def test_navigate_to_diary_success(self, poster):
        """Test successful navigation to diary."""
        diary_link = Mock()
        
        with patch.object(poster.wait, 'until') as mock_wait:
            mock_wait.side_effect = [diary_link, Mock()]  # Return link and container
            
            result = poster.navigate_to_diary()
            
            assert result is True
    
    def test_upload_photos(self, poster, mock_driver, tmp_path):
        """Test photo upload."""
        # Create test files
        photo1 = tmp_path / "photo1.jpg"
        photo2 = tmp_path / "photo2.jpg"
        photo1.write_text("test")
        photo2.write_text("test")
        
        file_input = Mock()
        mock_driver.find_element.return_value = file_input
        
        result = poster.upload_photos([str(photo1), str(photo2)])
        
        assert result is True
        assert file_input.send_keys.call_count == 2
    
    def test_set_diary_content(self, poster, mock_driver):
        """Test setting diary content."""
        title_field = Mock()
        content_field = Mock()
        tags_field = Mock()
        
        mock_driver.find_element.side_effect = [
            title_field,
            content_field,
            tags_field
        ]
        
        result = poster.set_diary_content(
            "Test Title",
            "Test Content",
            ["tag1", "tag2"]
        )
        
        assert result is True
        title_field.send_keys.assert_called_once_with("Test Title")
        content_field.send_keys.assert_called_once_with("Test Content")
        tags_field.send_keys.assert_called_once_with("tag1, tag2")
    
    def test_post_diary_entry_complete_workflow(self, poster, tmp_path):
        """Test complete diary posting workflow."""
        # Create test photo
        photo = tmp_path / "test.jpg"
        photo.write_text("test")
        
        # Mock all methods
        poster.navigate_to_diary = Mock(return_value=True)
        poster.create_new_entry = Mock(return_value=True)
        poster.upload_photos = Mock(return_value=True)
        poster.set_diary_content = Mock(return_value=True)
        poster.publish_entry = Mock(return_value=True)
        
        result = poster.post_diary_entry(
            "Test Title",
            "Test Content",
            [str(photo)],
            ["tag1"]
        )
        
        assert result["success"] is True
        assert result["entry_url"] == "https://himedeco.jp/diary/entry/123"
        poster.navigate_to_diary.assert_called_once()
        poster.create_new_entry.assert_called_once()
        poster.upload_photos.assert_called_once_with([str(photo)])


class TestHimeDecoConfig:
    """Test HimeDecoConfig class."""
    
    def test_config_defaults(self):
        """Test config with defaults."""
        config = HimeDecoConfig(
            username="testuser",
            password="testpass"
        )
        
        assert config.username == "testuser"
        assert config.password == "testpass"
        assert config.base_url == "https://himedeco.jp"
        assert config.max_photos_per_entry == 10
        assert config.headless is False
    
    def test_config_from_dict(self):
        """Test creating config from dictionary."""
        config_dict = {
            "username": "testuser",
            "password": "testpass",
            "max_photos_per_entry": 5,
            "headless": True
        }
        
        config = HimeDecoConfig.from_dict(config_dict)
        
        assert config.username == "testuser"
        assert config.max_photos_per_entry == 5
        assert config.headless is True


class TestHimeDecoClient:
    """Test HimeDecoClient class."""
    
    @pytest.fixture
    def config(self):
        """Create test config."""
        return HimeDecoConfig(
            username="testuser",
            password="testpass"
        )
    
    @pytest.fixture
    def client(self, config):
        """Create HimeDecoClient instance."""
        return HimeDecoClient(config)
    
    def test_initialize_driver(self, client):
        """Test driver initialization."""
        with patch('bot.services.himedeco_client.main.DriverFactory') as mock_factory:
            mock_driver = Mock()
            mock_factory.return_value.create_driver.return_value = mock_driver
            
            result = client.initialize_driver()
            
            assert result is True
            assert client.driver == mock_driver
            assert client.poster is not None
    
    def test_post_diary_validation(self, client):
        """Test diary posting with validation."""
        client.poster = Mock()
        client.poster.post_diary_entry.return_value = {"success": True}
        
        # Test with oversized inputs
        long_title = "x" * 200  # Over max length
        long_content = "y" * 6000  # Over max length
        many_photos = [f"photo{i}.jpg" for i in range(20)]  # Over max photos
        many_tags = [f"tag{i}" for i in range(20)]  # Over max tags
        
        result = client.post_diary(
            long_title,
            long_content,
            many_photos,
            many_tags
        )
        
        assert result is True
        
        # Verify truncation
        call_args = client.poster.post_diary_entry.call_args[0]
        assert len(call_args[0]) == 100  # Title truncated
        assert len(call_args[1]) == 5000  # Content truncated
        assert len(call_args[2]) == 10  # Photos limited
        assert len(call_args[3]) == 10  # Tags limited
    
    def test_cleanup(self, client):
        """Test cleanup method."""
        mock_driver = Mock()
        client.driver = mock_driver
        
        client.cleanup()
        
        mock_driver.quit.assert_called_once()