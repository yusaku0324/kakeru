import os
import asyncio
import csv
import subprocess
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote
from dotenv import load_dotenv
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from playwright_stealth import stealth_async # Keep for consistency, though may not be strictly needed with cookies
import requests
import time
import urllib.parse
import logging
import traceback

# --- Logger Initialization --- 
logger = logging.getLogger("marshmallow_video_processor")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")
# --- End Logger Initialization ---

load_dotenv()
BASE_URL = "https://marshmallow-qa.com" # For constructing full URLs if needed
IMAGE_SAVE_DIR = Path("images")
VIDEO_SAVE_DIR = Path("videos")
IMAGE_SAVE_DIR.mkdir(exist_ok=True)
VIDEO_SAVE_DIR.mkdir(exist_ok=True)
CUSTOM_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
COOKIE_FILE = Path("marshmallow_cookies.json")
MESSAGE_URLS_CSV = Path("message_urls.csv")
PROCESSED_LOG_PATH = Path("processed_video_log.csv") # To log processed items

async def get_image_download_links_from_page(page, current_page_url):
    print(f"  Accessing page: {current_page_url}")
    await page.goto(current_page_url, wait_until="domcontentloaded", timeout=30000)

    if "お詫びとして猫をご用意しました" in await page.content():
        print(f"  Cat page detected at {current_page_url}. Skipping.")
        await page.screenshot(path=f"cat_page_{Path(current_page_url).name}.png")
        return []
    
    download_link_selector = 'a[download][href*="media.marshmallow-qa.com/system/images/"]'
    print(f"  Looking for image download links with selector: {download_link_selector}")
    
    try:
        # Check if any such link exists, wait for a short period
        await page.wait_for_selector(download_link_selector, state="visible", timeout=7000) 
    except PlaywrightTimeoutError:
        print(f"  No image download links found on {current_page_url}.")
        # Optionally save a screenshot if no links are found on a page expected to have one
        # await page.screenshot(path=f"no_download_links_{Path(current_page_url).name}.png")
        return []
        
    link_elements = await page.query_selector_all(download_link_selector)
    urls = set() # Use set to avoid duplicate URLs if multiple identical links exist
    print(f"  Found {len(link_elements)} potential image download link(s) on {current_page_url}.")
    for link in link_elements:
        href = await link.get_attribute("href")
        if href:
            full_url = urljoin(BASE_URL, href.strip()) # Ensure it's an absolute URL
            urls.add(full_url)
            
    if not urls:
        print(f"  No usable image URLs extracted from download links on {current_page_url}.")
    return list(urls)

async def download_image(session, image_url: str, save_dir: Path) -> Path | None:
    try:
        print(f"    Downloading image from: {image_url}")
        response = session.get(image_url, timeout=20)
        response.raise_for_status()
        
        # Try to get filename from URL path
        parsed_url = urlparse(image_url)
        filename = Path(unquote(parsed_url.path)).name
        if not filename:
            filename = f"marshmallow_image_{int(time.time())}.png" # Fallback
        
        image_path = save_dir / filename
        with open(image_path, "wb") as f:
            f.write(response.content)
        print(f"    Image saved to {image_path}")
        return image_path
    except requests.RequestException as e:
        print(f"    Error downloading image {image_url}: {e}")
    except Exception as e:
        print(f"    Unexpected error saving image {image_url}: {e}")
    return None

async def convert_image_to_video(image_path: Path, video_dir: Path, duration: int = 1) -> Path | None:
    video_filename = image_path.name + ".mp4"
    output_path = video_dir / video_filename
    # Scale to even dimensions, e.g., force height to be even, width will auto-adjust (or vice-versa)
    # Using -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" for robustness if dimensions are already even.
    # More specific: scale=width:height, e.g., scale=1280:-2 (height auto, divisible by 2)
    # Forcing height to 720 for consistency, width will adjust, ensuring divisible by 2.
    # Forcing output to be even dimensions by truncating to nearest multiple of 2.
    ffmpeg_command = [
        "ffmpeg",
        "-loop", "1",
        "-i", str(image_path),
        "-t", str(duration),
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", # Ensure even dimensions and yuv420p
        "-c:v", "libx264",
        "-preset", "medium",
        "-movflags", "+faststart",
        str(output_path),"-y"
    ]
    try:
        print(f"    Converting {image_path} to {output_path}...")
        process = subprocess.run(ffmpeg_command, capture_output=True, text=True, check=True, timeout=30)
        print(f"    Video saved to {output_path}")
        return output_path
    except FileNotFoundError:
        print("    Error: ffmpeg command not found. Please ensure ffmpeg is installed and in your PATH.")
    except subprocess.CalledProcessError as e:
        print(f"    Error during video conversion for {image_path}:")
        print(f"      ffmpeg stdout: {e.stdout}")
        print(f"      ffmpeg stderr: {e.stderr}")
    except subprocess.TimeoutExpired:
        print(f"    Error: ffmpeg conversion for {image_path} timed out.")
    except Exception as e:
        print(f"    Unexpected error during video conversion for {image_path}: {e}")
    return None

async def process_single_message_url(page, message_url: str, question_text: str, session, video_map_data: list):
    print(f"Processing message URL: {message_url} for question: \"{question_text[:50]}...\"")
    try:
        await page.goto(message_url, wait_until="domcontentloaded", timeout=30000) # Increased timeout
        
        # Check for "お詫びとして猫をご用意しました" message which indicates an error or invalid page
        if "お詫びとして猫をご用意しました" in await page.content():
            print("  Cat page detected. Skipping.")
            # Save a screenshot for debugging
            await page.screenshot(path=f"error_cat_page_{Path(message_url).name}.png")
            return

        # Locate image download links more reliably
        # This selector targets <a> tags with a 'download' attribute and a specific href pattern
        image_link_elements = await page.locator("a[download][href*='media.marshmallow-qa.com/system/images/']").all()

        if not image_link_elements:
            print("  No image download links found on this page.")
            # Save a screenshot for debugging if no links are found
            await page.screenshot(path=f"error_no_link_found_{Path(message_url).name}.png")
            return

        print(f"  Found {len(image_link_elements)} image download link(s).")
        # Process only the first image found for simplicity, as per previous logic
        first_image_link = image_link_elements[0]
        image_url = await first_image_link.get_attribute("href")
        if not image_url:
            print("  Could not extract href from image download link.")
            return
        
        absolute_image_url = urljoin(BASE_URL, image_url) # Use urllib.parse.urljoin with BASE_URL
        print(f"  Image URL to download: {absolute_image_url}")

        downloaded_image_path = await download_image(session, absolute_image_url, IMAGE_SAVE_DIR)
        if downloaded_image_path:
            converted_video_path = await convert_image_to_video(downloaded_image_path, VIDEO_SAVE_DIR)
            if converted_video_path:
                print(f"  Successfully processed and created video: {converted_video_path}")
                
                # Attempt to create a path relative to the current working directory
                try:
                    relative_video_path = converted_video_path.relative_to(Path.cwd())
                except ValueError:
                    # Fallback if CWD is not an ancestor of converted_video_path
                    # This assumes VIDEO_SAVE_DIR.name is a root part of the desired relative path (e.g., "videos")
                    # and converted_video_path is like /some/path/videos/account/file.mp4
                    # or videos/account/file.mp4 if already relative but not to CWD.
                    path_parts = list(converted_video_path.parts)
                    try:
                        # Find the VIDEO_SAVE_DIR.name component (e.g., "videos") in the path
                        base_folder_index = path_parts.index(VIDEO_SAVE_DIR.name)
                        relative_video_path = Path(*path_parts[base_folder_index:])
                    except ValueError:
                        # If VIDEO_SAVE_DIR.name is not in the path, or for simpler structures,
                        # construct path like "videos/filename.mp4"
                        relative_video_path = Path(VIDEO_SAVE_DIR.name) / converted_video_path.name
                        logger.warning(
                            f"Could not form structured relative path for {converted_video_path} "
                            f"based on CWD or VIDEO_SAVE_DIR name \'{VIDEO_SAVE_DIR.name}\'. "
                            f"Using simplified relative path: {relative_video_path}"
                        )
                    logger.info(f"Used fallback logic for relative_video_path: {relative_video_path}")

                video_map_data.append({
                    "question": question_text,
                    "video_path": str(relative_video_path) # Store relative path
                })
            else:
                print("  Video conversion failed.")
        else:
            print("  Image download failed.")

    except PlaywrightTimeoutError:
        logger.error(f"  Timeout processing URL: {message_url}")
        # Attempt to take a screenshot, but handle potential errors if page is not in a state to do so.
        try:
            await page.screenshot(path=f"error_timeout_{Path(message_url).name}.png")
        except Exception as screenshot_error:
            logger.error(f"  Failed to take screenshot on PlaywrightTimeoutError for {message_url}: {screenshot_error}")
    except Exception as e:
        logger.error(f"  Error processing {message_url}: {type(e).__name__} - {str(e)}")
        logger.debug(traceback.format_exc())
        # Attempt to take a screenshot
        try:
            await page.screenshot(path=f"error_generic_{Path(message_url).name}.png")
        except Exception as screenshot_error:
            logger.error(f"  Failed to take screenshot on general error for {message_url}: {screenshot_error}")

async def main():
    if not MESSAGE_URLS_CSV.exists():
        print(f"Error: Message URLs CSV file not found at {MESSAGE_URLS_CSV}")
        return
    if not COOKIE_FILE.exists():
        print(f"Error: Cookie file not found at {COOKIE_FILE}")
        return

    messages_to_process = []
    with open(MESSAGE_URLS_CSV, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            messages_to_process.append({"url": row["url"], "question": row["question"]})

    if not messages_to_process:
        print("No messages found in CSV to process.")
        return

    video_map_data = [] # Initialize list for video mapping

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            storage_state=str(COOKIE_FILE.resolve()), 
            user_agent=CUSTOM_USER_AGENT,
            java_script_enabled=True # Ensure JS is enabled
        )
        page = await context.new_page()
        # await stealth_async(page) # Stealth might not be needed with cookies, can cause issues

        with requests.Session() as session:
            # Update session with cookies from Playwright context if necessary for requests
            # This part is tricky as Playwright cookies are in browser, requests needs them explicitly.
            # For simplicity, direct download with requests might not use browser's session state perfectly.
            # However, marshmallow media URLs are often public once known.
            pass # Using a plain requests session for downloads for now

            for i, item in enumerate(messages_to_process):
                print(f"\n--- Processing item {i+1}/{len(messages_to_process)} ---")
                await process_single_message_url(page, item["url"], item["question"], session, video_map_data)
                await asyncio.sleep(2) # Small delay between processing pages
        
        await browser.close()

    # Write the video mapping data to CSV
    if video_map_data:
        map_file_path = Path("video_question_map.csv")
        print(f"\nWriting video-to-question map to {map_file_path}...")
        with open(map_file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["question", "video_path"])
            writer.writeheader()
            writer.writerows(video_map_data)
        print(f"Mapping file {map_file_path} created with {len(video_map_data)} entries.")
    else:
        print("No videos were successfully processed to create a map.")

    print("\nProcessing complete.")

if __name__ == "__main__":
    asyncio.run(main()) 