import time
import logging
import json
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    ElementClickInterceptedException,
)
import datetime  # datetime をインポート
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
import yaml  # 追加
from selenium_stealth import stealth  # 追加

logger = logging.getLogger(__name__)


class DMSender:
    def __init__(
        self, driver: webdriver.Chrome, account_name: str, cookies_dir: str = "cookies"
    ):
        self.driver = driver
        self.account_name = account_name
        self.cookies_path = Path(cookies_dir) / f"{account_name}_cookies.json"
        self.base_url = "https://x.com"

    def _save_debug_info(self, stage_name: str, username: str = "unknown"):
        """デバッグ用のHTMLとスクリーンショットを保存する"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        # ユーザー名をファイル名に含めるが、長すぎたり特殊文字がある場合はトリミング
        safe_username = "".join(c if c.isalnum() else "_" for c in username)[:30]
        filename_base = f"debug_dm_{stage_name}_{safe_username}_{timestamp}"
        try:
            with open(f"{filename_base}.html", "w", encoding="utf-8") as f:
                f.write(self.driver.page_source)
            self.driver.save_screenshot(f"{filename_base}.png")
            logger.info(f"Saved debug info: {filename_base}.html/png")
        except Exception as e:
            logger.error(f"Failed to save debug info for {stage_name}: {e}")

    def _load_cookies(self) -> bool:
        """
        cookies/*.json から .x.com / .twitter.com の両方を読み込み、
        ドメイン毎に driver.get() → add_cookie() する
        """
        json_path = Path(self.cookies_path.parent) / f"{self.account_name}_cookies.json"
        logger.info(f"[DMSender] Cookie file path: {json_path.resolve()}")
        logger.info(f"[DMSender] Cookie file exists: {json_path.exists()}")
        if not json_path.exists():
            logger.error("Cookie file not found")
            return False

        with open(json_path, "r", encoding="utf-8") as f:
                cookies = json.load(f)

        from collections import defaultdict
        by_domain: dict[str, list[dict]] = defaultdict(list)
        for c in cookies:
            domain_root = c["domain"].lstrip(".") if c.get("domain") else ""
            by_domain[domain_root].append(c)

        for domain_root, ck_list in by_domain.items():
            url = f"https://{domain_root}"
            logger.info(f"[DMSender] Navigating to {url} for cookie injection")
            self.driver.get(url)
            time.sleep(1)
            for ck in ck_list:
                ck = ck.copy()
                # __Host-系は domain=None で注入（Selenium 4.20以降）
                if ck.get("name", "").startswith("__Host-"):
                    ck["domain"] = None
                ck.pop("sameSite", None)
                ck.pop("storeId", None)
                ck.pop("id", None)
                if "expiry" in ck:
                    try:
                        ck["expiry"] = int(ck["expiry"])
                        if ck["expiry"] < time.time():
                            logger.info(f"Skip expired cookie: {ck['name']}")
                            continue
                    except Exception:
                        ck.pop("expiry", None)
                if "domain" in ck and isinstance(ck["domain"], str):
                    ck["domain"] = ck["domain"].lstrip(".")
                try:
                    self.driver.add_cookie(ck)
                except Exception as e:
                    logger.warning(f"Skip cookie {ck.get('name')}: {e}")
            self.driver.refresh()
            time.sleep(1)

        # 認証フローJSページへ遷移してセッションを安定化
        self.driver.get("https://x.com/i/flow/login?redirect_after_login=/home")
        time.sleep(2)
        self.driver.refresh()
        time.sleep(1)

        logger.info("✅ All cookies injected (.x.com / .twitter.com)")
        return True

    def _is_logged_in(self) -> bool:
        logger.info(f"[DMSender] Navigating to: {self.base_url}/home for login check")
        self.driver.get(f"{self.base_url}/home")
        time.sleep(2)
        src = self.driver.page_source
        logger.info("Saving login_check debug info...")
        self._save_debug_info("login_check", self.account_name)
        logger.info("Saved login_check debug info.")

        # ① 左上のホームリンク＋アカウントスイッチャー
        if "AppTabBar_AccountSwitcher_Button" in src:
            return True
        # ② More メニュー (モバイル縮小時でも残る)
        if "AppTabBar_More_Menu" in src and f"@{self.account_name.lower()}" in src.lower():
            return True
        # 旧 UI 用バックアップ
        if "SideNav_AccountSwitcher_Button" in src:
            return True
            return False

    def send_dm(self, target_username: str, message_text: str) -> bool:
        logger.info(
            f"Attempting to send DM to {target_username} from {self.account_name} with message: '{message_text[:50].replace(chr(10), ' ')}...'"
        )
        self._save_debug_info("start_send_dm", target_username)

        # Cookie/認証有効性チェック
        if not self._is_logged_in():
            logger.error(f"Not logged in after loading cookies for {self.account_name}. Aborting DM send.")
            self._save_debug_info("not_logged_in", target_username)
            return False

        try:
            logger.info(f"[DMSender] Navigating to: {self.base_url}/messages for DM send")
            self.driver.get(f"{self.base_url}/messages")
            time.sleep(3)
            logger.info("Navigated to messages page.")
            self._save_debug_info("messages_page", target_username)

            # --- NewDMボタン検出＋リトライ強化 ---
            new_dm_button_found_and_clicked = False
            for retry in range(2):
                try:
                    new_dm_button = WebDriverWait(self.driver, 20).until(
                        EC.element_to_be_clickable(
                            (By.CSS_SELECTOR, "[data-testid='NewDM_Button']")
                        )
                    )
                    new_dm_button.click()
                    logger.info("Clicked 'NewDM_Button' to go to compose screen.")
                    time.sleep(2)
                    self._save_debug_info("compose_screen", target_username)
                    new_dm_button_found_and_clicked = True
                    break
                except Exception as e:
                    logger.error(f"Could not find or click NewDM_Button (retry {retry+1}/2): {e}")
                    self._save_debug_info(f"new_dm_button_fail_retry{retry+1}", target_username)
                    if retry == 0:
                        logger.info("Retrying: Reloading messages page and waiting...")
                        self.driver.refresh()
                        time.sleep(4)
            
            if not new_dm_button_found_and_clicked:
                logger.error("Failed to find or click NewDM_Button after all retries.")
                return False

            search_user_input_xpath = "//input[@data-testid='searchPeople']"
            try:
                search_input = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, search_user_input_xpath))
                )
                search_input.send_keys(target_username)
                logger.info(
                    f"Typed target username '{target_username}' in search input."
                )
                time.sleep(3)  # 検索結果表示待ち
                self._save_debug_info("user_search_typed", target_username)
            except TimeoutException:
                logger.error("ユーザー検索欄が見つかりませんでした")
                self._save_debug_info("user_search_fail", target_username)
                return False

            normalized_target_username = target_username.lstrip(
                "@"
            ).lower()  # 比較用に小文字化
            found_target_to_click = None
            dm_send_not_allowed_for_target = False

            try:
                candidate_buttons = WebDriverWait(self.driver, 15).until(
                    EC.presence_of_all_elements_located(
                        (By.CSS_SELECTOR, "button[data-testid='TypeaheadUser']")
                    )
                )
                logger.info(f"TypeaheadUser ボタン候補数: {len(candidate_buttons)}")

                for btn_element in candidate_buttons:
                    btn_text_content = ""
                    try:
                        aria_label = btn_element.get_attribute("aria-label")
                        if aria_label:
                            btn_text_content += aria_label + " "

                        # 親要素を辿って関連テキストを取得 (最大3階層)
                        # XのUIは複雑なので、spanだけでなくdiv内のテキストも見ることを検討
                        # また、UserCellのようなコンテナ要素を特定できればその中を探索する方が良い
                        current_element_for_text = btn_element
                        for i in range(3):  # 3階層まで親を辿る
                            try:
                                # 可視テキストのみを取得する方がノイズが減る場合がある
                                # immediate_text = self.driver.execute_script("return arguments[0].childNodes[0].nodeValue;", current_element_for_text)
                                # if immediate_text: btn_text_content += immediate_text.strip() + " "
                                spans = current_element_for_text.find_elements(
                                    By.XPATH, ".//span[not(self::button//span)]"
                                )  # ボタン内部のspanは除外
                                for span in spans:
                                    if span.text:
                                        btn_text_content += span.text.strip() + " "
                                if (
                                    current_element_for_text.get_attribute(
                                        "data-testid"
                                    )
                                    == "UserCell"
                                ):
                                    break  # UserCellまで到達したら探索終了
                                parent = current_element_for_text.find_element(
                                    By.XPATH, ".."
                                )
                                if parent.tag_name == "html":
                                    break  # htmlタグまで行ったら終了
                                current_element_for_text = parent
                            except NoSuchElementException:
                                break  # 親が見つからなければ終了
                        btn_text_content = " ".join(
                            btn_text_content.split()
                        ).lower()  # 正規化
                        logger.info(f"候補ボタン関連テキスト: {btn_text_content}")

                        is_target_user_button = False
                        # ターゲットユーザー名（小文字）が、収集したテキスト（小文字）に含まれるか
                        if normalized_target_username in btn_text_content:
                            is_target_user_button = True

                        if is_target_user_button:
                            is_disabled = (
                                btn_element.get_attribute("aria-disabled") == "true"
                                or btn_element.get_attribute("disabled") is not None
                            )

                            if (
                                "メッセージを送信できません" in btn_text_content
                                or "not available for messaging" in btn_text_content
                                or "can't be messaged" in btn_text_content
                                or is_disabled
                            ):
                                logger.warning(
                                    f"DM送信不可検出: @{target_username} はメッセージ不可またはボタン無効。テキスト: {btn_text_content}, disabled: {is_disabled}"
                                )
                                dm_send_not_allowed_for_target = True
                                break

                            found_target_to_click = btn_element
                            logger.info(f"選択候補発見: {btn_text_content}")
                            break
                    except Exception as e:
                        logger.warning(f"ユーザー候補ボタン処理中にエラー: {e}")

                if dm_send_not_allowed_for_target:
                    self._save_debug_info("dm_not_allowed_target", target_username)
                    return False

                if not found_target_to_click:
                    logger.error(
                        f"検索候補に '{normalized_target_username}' を含むクリック可能なボタンが見つかりませんでした"
                    )
                    self._save_debug_info(
                        "user_button_not_found_clickable", target_username
                    )
                    return False

                try:
                    logger.info(
                        f"クリック試行対象: {found_target_to_click.get_attribute('aria-label') or found_target_to_click.text}"
                    )
                    WebDriverWait(self.driver, 10).until(
                        EC.element_to_be_clickable(found_target_to_click)
                    )
                    found_target_to_click.click()
                    logger.info("ユーザー候補選択クリック成功")
                    time.sleep(2)
                    self._save_debug_info("user_select_success", target_username)
                except ElementClickInterceptedException as eci:
                    logger.error(
                        f"ユーザー候補クリックがインターセプトされました: {eci}"
                    )
                    self._save_debug_info("user_click_intercepted", target_username)
                    try:
                        self.driver.execute_script(
                            "arguments[0].click();", found_target_to_click
                        )
                        logger.info("JavaScriptによるユーザー候補クリック成功")
                        time.sleep(2)
                        self._save_debug_info(
                            "user_select_js_click_success", target_username
                        )
                    except Exception as js_e:
                        logger.error(
                            f"JavaScriptによるユーザー候補クリックも失敗: {js_e}"
                        )
                        self._save_debug_info(
                            "user_select_js_click_fail", target_username
                        )
                        return False
                except Exception as click_e:
                    logger.error(
                        f"ユーザー候補のクリックに失敗 (インターセプト以外): {click_e}"
                    )
                    self._save_debug_info("user_click_fail_other", target_username)
                    return False

                next_button_xpath = "//div[@data-testid='nextButton'] | //button[@data-testid='nextButton']"
                try:
                    WebDriverWait(self.driver, 15).until(
                        lambda d: d.find_element(
                            By.XPATH, next_button_xpath
                        ).is_enabled()
                    )
                    btn = self.driver.find_element(By.XPATH, next_button_xpath)
                    btn.click()
                    logger.info("Clicked 'Next' button to start DM conversation.")
                    time.sleep(3)
                    self._save_debug_info("next_button_click", target_username)
                except TimeoutException:
                    logger.error("次へボタンが有効化されませんでした")
                    self._save_debug_info("next_button_timeout", target_username)
                    return False
                except Exception as e:
                    logger.error(f"次へボタン操作時にエラー: {e}")
                    self._save_debug_info("next_button_error", target_username)
                    return False

            except TimeoutException:
                logger.error(
                    "ユーザー候補のボタン (TypeaheadUser) がリストとして見つかりませんでした"
                )
                self._save_debug_info("typeaheaduser_list_timeout", target_username)
                return False

        except TimeoutException as te:
            logger.error(f"Timeout during DM setup for {target_username}: {te}")
            self._save_debug_info("dm_setup_timeout", target_username)
            return False
        except Exception as e:
            logger.error(f"Error during DM setup for {target_username}: {e}")
            self._save_debug_info("dm_setup_error", target_username)
            return False

        # --- メッセージ入力と送信 (Draft.js対応・安定版) ---
        message_input_xpaths = [
            "//div[@data-testid='dmComposerTextInput' and @contenteditable='true']",
            "//div[@data-testid='dmComposerTextInput']",
            "//div[contains(@class, 'public-DraftEditor-content') and @contenteditable='true']",
            "//div[@data-testid='dmComposerTextInput']//div[@contenteditable='true']",
        ]
        message_input_element = None
        for xpath_idx, xpath in enumerate(message_input_xpaths):
            try:
                logger.info(
                    f"DM入力欄検索試行 {xpath_idx + 1}/{len(message_input_xpaths)} (XPath: {xpath})"
                )
                message_input_element = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, xpath))
                )
                logger.info(f"DM入力欄発見 by XPath: {xpath}")
                break
            except TimeoutException:
                logger.warning(f"DM入力欄見つからず by XPath: {xpath}")
                continue

        if not message_input_element:
            logger.error(
                f"最終的にDM入力欄が見つかりませんでした (試行回数: {len(message_input_xpaths)})"
            )
            self._save_debug_info(
                "dm_input_final_not_found_v2", target_username
            )
            return False

        try:
            message_input_element.click()
            time.sleep(0.3)
            # JSでクリア＋inputイベント発火
            self.driver.execute_script("""
              const el = arguments[0];
              el.innerText = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            """, message_input_element)
            logger.info("DM input field cleared via JS+input event.")
            time.sleep(0.3)

            # 行ごとに send_keys（改行は Shift+Enter）
            lines = message_text.split("\n")
            for i, line in enumerate(lines):
                if i:
                    message_input_element.send_keys(
                        webdriver.common.keys.Keys.SHIFT,
                        webdriver.common.keys.Keys.ENTER,
                    )
                message_input_element.send_keys(line)
                time.sleep(0.1)

            # 念のためinputイベントを再発火（Draft.jsのstate更新遅延対策）
            self.driver.execute_script("""
              arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
            """, message_input_element)

            logger.info("Message text entered line by line (with input event).")
            self._save_debug_info(
                "dm_text_entered_v4", target_username
            )
            time.sleep(1.5)  # 送信ボタン有効化のための待機

            send_button_selectors = [
                "//button[@data-testid='dmComposerSendButton']",
                "//button[@aria-label='送信']",
                "//div[@data-testid='dmComposerSendButton']",
            ]
            final_button_to_click = None

            for i, selector in enumerate(send_button_selectors):
                logger.info(
                    f"送信ボタン検索試行 {i + 1}/{len(send_button_selectors)} (XPath: {selector})"
                )
                try:
                    candidate_button = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.XPATH, selector))
                    )
                    logger.info(
                        f"  送信ボタン候補 ({candidate_button.tag_name}) 発見 (XPath: {selector}). 活性化待機開始..."
                    )

                    WebDriverWait(self.driver, 15).until(
                        lambda d: (
                            candidate_button.get_attribute("disabled") is None
                            and candidate_button.get_attribute("aria-disabled")
                            != "true"
                            and candidate_button.is_displayed()
                            and candidate_button.is_enabled()
                        )
                    )

                    # 送信ボタンが無効のままなら、1文字入力→削除でinputイベントを強制発火
                    if candidate_button.get_attribute("aria-disabled") == "true":
                        from selenium.webdriver.common.action_chains import ActionChains
                        ActionChains(self.driver).send_keys(" ").send_keys(webdriver.common.keys.Keys.BACKSPACE).perform()
                        self.driver.execute_script("""
                          arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
                        """, message_input_element)
                        time.sleep(0.5)

                    final_button_to_click = WebDriverWait(self.driver, 3).until(
                        EC.element_to_be_clickable(candidate_button)
                    )
                    logger.info(f"  クリック可能な送信ボタンを確定 (XPath: {selector})")
                    break
                except TimeoutException:
                    logger.warning(
                        f"  タイムアウト: XPath {selector} で送信ボタンが期待される状態にならず。"
                    )
                    self._save_debug_info(
                        f"send_button_timeout_wait_active_s{i + 1}_v2", target_username
                    )  # デバッグファイル名変更
                except Exception as e:
                    logger.error(
                        f"  送信ボタン活性化待機中に予期せぬエラー (XPath: {selector}): {e}"
                    )
                    self._save_debug_info(
                        f"send_button_error_wait_active_s{i + 1}_v2", target_username
                    )  # デバッグファイル名変更

            if not final_button_to_click:
                logger.error("最終的にクリック可能な送信ボタンが見つかりませんでした。")
                self._save_debug_info("send_button_final_not_found_v4", target_username)
                return False

            try:
                logger.info(
                    f"送信ボタン ({final_button_to_click.tag_name}, aria-label: {final_button_to_click.get_attribute('aria-label')}) をクリックします。"
                )
                final_button_to_click.click()
                logger.info(
                    f"DM送信ボタンクリック成功 (通常クリック) for @{target_username}."
                )
                self._save_debug_info("send_button_clicked_normal_v4", target_username)
                time.sleep(3)
                return True
            except ElementClickInterceptedException as eci:
                logger.warning(
                    f"送信ボタンの通常クリックがインターセプトされました: {eci}。JavaScriptでのクリックを試みます。"
                )
                self._save_debug_info(
                    "send_button_click_intercepted_v4", target_username
                )
                try:
                    self.driver.execute_script(
                        "arguments[0].click();", final_button_to_click
                    )
                    logger.info(
                        f"DM送信ボタンクリック成功 (JSクリック) for @{target_username}."
                    )
                    self._save_debug_info(
                        "send_button_js_click_success_v4", target_username
                    )
                    time.sleep(3)
                    return True
                except Exception as js_e:
                    logger.error(f"JavaScriptによる送信ボタンクリックも失敗: {js_e}")
                    self._save_debug_info(
                        "send_button_js_click_fail_v4", target_username
                    )
                    return False
            except Exception as e:
                logger.error(f"送信ボタンのクリック中に予期せぬエラー: {e}")
                self._save_debug_info(
                    "send_button_click_error_final_v4", target_username
                )
                return False

        except Exception as e:
            logger.error(
                f"An unexpected error occurred while inputting or sending DM to {target_username}: {e}"
            )
            self._save_debug_info(
                "dm_send_error_final_v3", target_username
            )  # デバッグファイル名変更
            return False


if __name__ == "__main__":
    import sys
    print("--- dm_sender.py GUI NewDMボタンテスト ---")
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )
    file_handler = logging.FileHandler("dm_sender.log", encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    )
    logging.getLogger().addHandler(file_handler)

    if len(sys.argv) < 2:
        print("Usage: python dm_sender.py <account_name>")
        sys.exit(1)
    account_name = sys.argv[1]
    from selenium.webdriver.chrome.service import Service as ChromeService
    from webdriver_manager.chrome import ChromeDriverManager
    options = webdriver.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,800")
    # ヘッドレスOFFでGUI表示
    # options.add_argument("--headless")  # ←コメントアウト
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-popup-blocking")
    ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0.0.0 Safari/537.36"
    )
    options.add_argument(f"--user-agent={ua}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    service = ChromeService(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    stealth(
        driver,
        languages=["ja-JP", "ja"],
        vendor="Google Inc.",
        platform="MacIntel",
        webgl_vendor="Intel Inc.",
        renderer="Intel Iris OpenGL Engine",
        fix_hairline=True,
    )
    dm_sender = DMSender(driver, account_name)
    if not dm_sender._load_cookies():
        print(f"[ERROR] Cookie load failed for {account_name}")
        driver.quit()
        sys.exit(1)
    print("[INFO] Cookie loaded. Navigating to messages page...")
    driver.get(f"https://x.com/messages")
    time.sleep(3)
    print("[INFO] ページ表示後、NewDMボタン検出を試みます...")
    try:
        elem = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='NewDM_Button']"))
        )
        print("[SUCCESS] NewDMボタン検出！クリックします。")
        elem.click()
        print("[SUCCESS] クリック完了。5秒間この画面で停止します。目視で遷移を確認してください。")
        time.sleep(5)
    except Exception as e:
        print(f"[ERROR] NewDMボタン検出またはクリック失敗: {e}")
        dm_sender._save_debug_info("gui_new_dm_button_fail", account_name)
    driver.quit()
    print("[INFO] テスト終了。ブラウザを閉じました。")
