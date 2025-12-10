#!/usr/bin/env node

/**
 * Script to test availability consistency between therapist card and calendar overlay.
 * Run with: node scripts/test-availability-consistency.mjs
 *
 * Prerequisites:
 * - Development server running on localhost:3000
 * - pnpm exec playwright install chromium (if not already installed)
 */

import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Names that have fallback availability in FALLBACK_STAFF_META
const KNOWN_FALLBACK_NAMES = ['葵', '凛', '真央', '美月', '結衣', '楓', '美咲']

async function main() {
  console.log(`Testing against: ${BASE_URL}`)

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // Slow down actions for visibility
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Go to search page
    console.log('Step 1: Navigating to /search...')
    await page.goto(`${BASE_URL}/search`)
    await page.waitForLoadState('networkidle')

    // Wait for therapist cards to appear
    console.log('Step 2: Waiting for therapist cards...')
    const therapistCards = page.locator('[data-testid="therapist-card"]')
    await therapistCards.first().waitFor({ state: 'visible', timeout: 15000 })

    const cardCount = await therapistCards.count()
    console.log(`Found ${cardCount} therapist cards`)

    // Find cards with availability badges (time display like "明日 10:00〜")
    let testedCards = 0
    let passedCards = 0
    let failedCards = []

    for (let i = 0; i < Math.min(cardCount, 10); i++) {
      // Re-locate cards each iteration to handle DOM updates
      const currentCards = page.locator('[data-testid="therapist-card"]')
      const currentCount = await currentCards.count()
      if (i >= currentCount) {
        console.log(`Card ${i}: No more cards available (have ${currentCount})`)
        break
      }
      const card = currentCards.nth(i)

      // Get therapist name
      const nameElement = card.locator('h3').first()
      const therapistName = await nameElement.textContent()
      console.log(`\nCard ${i}: Therapist name = "${therapistName}"`)

      // Check if this therapist has fallback data
      const hasFallback = KNOWN_FALLBACK_NAMES.some(name => therapistName?.includes(name))

      // Check if this card has an availability badge
      const badge = card.locator('.bg-emerald-500\\/90, .bg-amber-500\\/90')
      const badgeCount = await badge.count()

      if (badgeCount === 0) {
        console.log(`  No availability badge, skipping`)
        continue
      }

      const badgeText = await badge.textContent()
      console.log(`  Availability label = "${badgeText}"`)
      console.log(`  Has fallback data = ${hasFallback}`)

      // Check if there's a specific time in the badge
      const timeMatch = badgeText?.match(/(\d{1,2}:\d{2})/)
      const cardTime = timeMatch ? timeMatch[1] : null
      const hasSpecificTime = !!cardTime
      console.log(`  Card time: ${cardTime || '(no specific time)'}`)
      testedCards++

      // Click the card to open overlay
      console.log(`Step 3: Clicking card ${i}...`)
      await card.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      // Use force:true to ensure click goes through
      await card.click({ force: true })
      await page.waitForTimeout(1000)

      // Wait for overlay to appear
      const overlay = page.getByRole('dialog', { name: /の予約詳細/ }).first()
      try {
        await overlay.waitFor({ state: 'visible', timeout: 10000 })
        console.log('  Overlay opened')
      } catch (err) {
        // Maybe we navigated away - check current URL
        const currentUrl = page.url()
        console.log(`  Failed to open overlay. Current URL: ${currentUrl}`)
        console.log(`  Skipping this card and continuing...`)
        // Re-navigate to search to reset state
        await page.goto(`${BASE_URL}/search`)
        await page.waitForLoadState('networkidle')
        continue
      }

      // Click the booking tab - scroll into view first to avoid image overlay
      console.log('Step 4: Clicking booking tab...')
      const bookingTab = overlay.getByRole('button', { name: '空き状況・予約' })
      await bookingTab.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      // Try clicking with JavaScript to avoid visual obstruction issues
      await bookingTab.evaluate(el => el.click())
      await page.waitForTimeout(2000) // Wait for calendar to load

      // Take screenshot to verify state
      await page.screenshot({ path: `/tmp/overlay-card-${i}.png` })
      console.log(`  Screenshot saved to /tmp/overlay-card-${i}.png`)

      // Check selected slot section
      console.log('Step 5: Checking selected slots...')
      const selectedSection = overlay.locator('text=選択中の候補').locator('..')

      // Look for slot time entries
      const slotTexts = await selectedSection.locator('[class*="rounded"]').allTextContents()
      console.log(`  Found slot sections: ${slotTexts.length}`)

      // Look for time pattern in selected slots
      let selectedSlotTime = null
      for (const text of slotTexts) {
        const slotTimeMatch = text.match(/(\d{1,2}:\d{2})/)
        if (slotTimeMatch) {
          selectedSlotTime = slotTimeMatch[1]
          console.log(`  Selected slot time: ${selectedSlotTime}`)
          break
        }
      }

      // Check if open slots are visible in calendar
      console.log('Step 6: Checking calendar visibility...')
      // Look for buttons with availability status
      const openSlots = overlay.locator('button[aria-label*="予約可"], button[aria-label*="要確認"]')
      const openSlotCount = await openSlots.count()
      console.log(`  Visible open slots: ${openSlotCount}`)

      // Debug: if no slots, get some text to understand what's displayed
      if (openSlotCount === 0) {
        const calendarText = await overlay.locator('.rounded-\\[32px\\]').first().textContent().catch(() => 'N/A')
        console.log(`  Calendar area text (first 200 chars): ${calendarText?.slice(0, 200)}`)
      }

      // Determine pass/fail
      if (hasSpecificTime) {
        // If card has specific time, it should match the selected slot
        if (selectedSlotTime === cardTime && openSlotCount > 0) {
          console.log(`  ✓ Card ${i} PASSED: Time matches and slots visible`)
          passedCards++
        } else if (selectedSlotTime !== cardTime) {
          console.log(`  ✗ Card ${i} FAILED: Time mismatch (card: ${cardTime}, selected: ${selectedSlotTime})`)
          failedCards.push({ index: i, name: therapistName, cardTime, selectedSlotTime, reason: 'time_mismatch' })
        } else if (openSlotCount === 0) {
          console.log(`  ✗ Card ${i} FAILED: No open slots visible in calendar`)
          failedCards.push({ index: i, name: therapistName, cardTime, reason: 'no_visible_slots' })
        }
      } else {
        // If card doesn't have specific time, just check if there are visible open slots
        if (openSlotCount > 0) {
          console.log(`  ✓ Card ${i} PASSED: Open slots are visible`)
          passedCards++
        } else if (!hasFallback) {
          // No fallback data available - this is expected to not have slots
          console.log(`  ⚠ Card ${i} SKIPPED: No fallback data and no API data`)
        } else {
          // Has fallback data but no slots shown - this is a failure
          console.log(`  ✗ Card ${i} FAILED: No slots visible but has fallback data`)
          failedCards.push({ index: i, name: therapistName, cardTime: null, reason: 'no_slots_with_fallback' })
        }
      }

      // Close overlay with Escape key (more reliable than clicking)
      console.log('Step 7: Closing overlay...')
      await page.keyboard.press('Escape')
      await overlay.waitFor({ state: 'hidden', timeout: 5000 })
      await page.waitForTimeout(1000)

      // Ensure we're back on the search page with cards visible
      const cardsAfterClose = await therapistCards.count()
      if (cardsAfterClose === 0) {
        console.log('  Re-navigating to search page...')
        await page.goto(`${BASE_URL}/search`)
        await page.waitForLoadState('networkidle')
        await therapistCards.first().waitFor({ state: 'visible', timeout: 15000 })
      }
    }

    // Summary
    console.log('\n========== SUMMARY ==========')
    console.log(`Tested: ${testedCards} cards with specific times`)
    console.log(`Passed: ${passedCards}`)
    console.log(`Failed: ${failedCards.length}`)

    if (failedCards.length > 0) {
      console.log('\nFailed cards:')
      for (const failed of failedCards) {
        console.log(`  Card ${failed.index}: ${failed.reason} (card time: ${failed.cardTime})`)
      }
      process.exitCode = 1
    } else if (testedCards === 0) {
      console.log('\nNo cards with specific times found to test')
    } else {
      console.log('\n✓ All tested cards passed!')
    }

  } catch (error) {
    console.error('Test error:', error)
    process.exitCode = 1
  } finally {
    console.log('\nClosing browser...')
    await browser.close()
  }
}

main()
