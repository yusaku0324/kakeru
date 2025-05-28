"""HimeDeco photo diary poster implementation."""
import logging
import time
from typing import List, Optional, Dict, Any
from pathlib import Path
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait
from selenium.common.exceptions import TimeoutException, WebDriverException

from bot.utils.backoff import BackoffHandler
from bot.utils.safe_click import safe_click

logger = logging.getLogger(__name__)


class HimeDecoPoster:
    """Handles posting to HimeDeco photo diary."""
    
    def __init__(self, driver, backoff_handler: Optional[BackoffHandler] = None):
        """Initialize HimeDeco poster.
        
        Args:
            driver: Selenium WebDriver instance
            backoff_handler: Optional backoff handler for retries
        """
        self.driver = driver
        self.backoff_handler = backoff_handler or BackoffHandler()
        self.wait = WebDriverWait(self.driver, 30)
        
    def login(self, username: str, password: str) -> bool:
        """Login to HimeDeco.
        
        Args:
            username: HimeDeco username
            password: HimeDeco password
            
        Returns:
            bool: True if login successful
        """
        try:
            logger.info("Navigating to HimeDeco login page")
            # Note: Replace with actual HimeDeco URL
            self.driver.get("https://himedeco.jp/login")
            
            # Wait for login form
            username_field = self.wait.until(
                EC.presence_of_element_located((By.ID, "username"))
            )
            password_field = self.driver.find_element(By.ID, "password")
            
            # Enter credentials
            username_field.send_keys(username)
            password_field.send_keys(password)
            
            # Click login button
            login_button = self.driver.find_element(By.ID, "login-button")
            safe_click(self.driver, login_button)
            
            # Wait for successful login (check for specific element)
            self.wait.until(
                EC.presence_of_element_located((By.CLASS_NAME, "dashboard"))
            )
            
            logger.info("Successfully logged in to HimeDeco")
            return True
            
        except TimeoutException:
            logger.error("Login timeout - could not find expected elements")
            return False
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return False
    
    def navigate_to_diary(self) -> bool:
        """Navigate to photo diary section.
        
        Returns:
            bool: True if navigation successful
        """
        try:
            logger.info("Navigating to photo diary section")
            
            # Click on diary menu (adjust selector based on actual site)
            diary_link = self.wait.until(
                EC.element_to_be_clickable((By.LINK_TEXT, "写メ日記"))
            )
            safe_click(self.driver, diary_link)
            
            # Wait for diary page to load
            self.wait.until(
                EC.presence_of_element_located((By.CLASS_NAME, "diary-container"))
            )
            
            return True
            
        except TimeoutException:
            logger.error("Could not navigate to diary section")
            return False
    
    def create_new_entry(self) -> bool:
        """Start creating a new diary entry.
        
        Returns:
            bool: True if new entry form opened
        """
        try:
            logger.info("Creating new diary entry")
            
            # Click new entry button
            new_entry_btn = self.wait.until(
                EC.element_to_be_clickable((By.CLASS_NAME, "new-diary-button"))
            )
            safe_click(self.driver, new_entry_btn)
            
            # Wait for entry form
            self.wait.until(
                EC.presence_of_element_located((By.CLASS_NAME, "diary-form"))
            )
            
            return True
            
        except TimeoutException:
            logger.error("Could not open new entry form")
            return False
    
    def upload_photos(self, photo_paths: List[str]) -> bool:
        """Upload photos to diary entry.
        
        Args:
            photo_paths: List of photo file paths
            
        Returns:
            bool: True if all photos uploaded successfully
        """
        try:
            logger.info(f"Uploading {len(photo_paths)} photos")
            
            # Find file input element
            file_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='file']")
            
            # Upload each photo
            for photo_path in photo_paths:
                if not Path(photo_path).exists():
                    logger.warning(f"Photo not found: {photo_path}")
                    continue
                    
                file_input.send_keys(str(Path(photo_path).absolute()))
                time.sleep(1)  # Wait for upload
            
            logger.info("Photos uploaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Photo upload failed: {str(e)}")
            return False
    
    def set_diary_content(self, title: str, content: str, tags: Optional[List[str]] = None) -> bool:
        """Set diary entry content.
        
        Args:
            title: Entry title
            content: Entry content/description
            tags: Optional list of tags
            
        Returns:
            bool: True if content set successfully
        """
        try:
            logger.info("Setting diary content")
            
            # Set title
            title_field = self.driver.find_element(By.ID, "diary-title")
            title_field.clear()
            title_field.send_keys(title)
            
            # Set content
            content_field = self.driver.find_element(By.ID, "diary-content")
            content_field.clear()
            content_field.send_keys(content)
            
            # Set tags if provided
            if tags:
                tags_field = self.driver.find_element(By.ID, "diary-tags")
                tags_field.clear()
                tags_field.send_keys(", ".join(tags))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to set content: {str(e)}")
            return False
    
    def publish_entry(self) -> bool:
        """Publish the diary entry.
        
        Returns:
            bool: True if published successfully
        """
        try:
            logger.info("Publishing diary entry")
            
            # Click publish button
            publish_btn = self.wait.until(
                EC.element_to_be_clickable((By.ID, "publish-button"))
            )
            safe_click(self.driver, publish_btn)
            
            # Wait for confirmation or success message
            self.wait.until(
                EC.presence_of_element_located((By.CLASS_NAME, "success-message"))
            )
            
            logger.info("Diary entry published successfully")
            return True
            
        except TimeoutException:
            logger.error("Publishing timeout - entry may not have been published")
            return False
        except Exception as e:
            logger.error(f"Publishing failed: {str(e)}")
            return False
    
    def post_diary_entry(
        self,
        title: str,
        content: str,
        photo_paths: List[str],
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Complete diary posting workflow.
        
        Args:
            title: Entry title
            content: Entry content
            photo_paths: List of photo file paths
            tags: Optional list of tags
            
        Returns:
            Dict with posting result
        """
        result = {
            "success": False,
            "error": None,
            "entry_url": None
        }
        
        try:
            # Navigate to diary section
            if not self.navigate_to_diary():
                result["error"] = "Failed to navigate to diary"
                return result
            
            # Create new entry
            if not self.create_new_entry():
                result["error"] = "Failed to create new entry"
                return result
            
            # Upload photos
            if photo_paths and not self.upload_photos(photo_paths):
                result["error"] = "Failed to upload photos"
                return result
            
            # Set content
            if not self.set_diary_content(title, content, tags):
                result["error"] = "Failed to set content"
                return result
            
            # Publish entry
            if not self.publish_entry():
                result["error"] = "Failed to publish entry"
                return result
            
            # Get entry URL
            current_url = self.driver.current_url
            result["success"] = True
            result["entry_url"] = current_url
            
            logger.info(f"Successfully posted diary entry: {current_url}")
            
        except Exception as e:
            logger.error(f"Unexpected error during posting: {str(e)}")
            result["error"] = str(e)
        
        return result