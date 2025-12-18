# JST Date/Time Handling Implementation Plan

## Preconditions

This implementation assumes the following preconditions are met:
- Valid therapist cards exist in the system
- Each therapist card belongs to exactly one shop  
- Valid shifts have been created and exist in the system
- Shift creation workflows and business constraints are handled upstream

**Scope**: This implementation covers availability calculation from existing shifts and UI display consistency only.

## Phase 1: Safe Refactor（挙動を一切変えないリファクタ）

### 1.1 Import統一・非推奨関数削除

- [ ] 1. Clean up availability.ts deprecated functions
  - Remove deprecated wrapper functions that delegate to lib/jst.ts
  - Update all import statements to use lib/jst.ts directly
  - Ensure zero behavioral changes - only import path modifications
  - _Requirements: 2.1, 2.2_

**影響ファイル一覧**:
- `osakamenesu/apps/web/src/lib/availability.ts` (削除対象関数6個)
- 全ての`availability.ts`をimportしているファイル (import文更新)

**意味的同値性の保証**:
```typescript
// 削除前: availability.ts経由
import { getTodayIsoString } from '@/lib/availability'
const today = getTodayIsoString()

// 削除後: jst.ts直接
import { today } from '@/lib/jst'  
const todayValue = today()

// 同値性: getTodayIsoString() === today() (完全に同じ値を返す)
```

- [ ] 2. Update import statements across codebase
  - Replace availability.ts deprecated function imports with lib/jst.ts direct imports
  - Maintain exact same function call semantics
  - Verify no behavioral changes through existing test suite
  - _Requirements: 2.1_

**変更内容が意味的に同値である理由**:
1. **削除対象関数は全て単純なラッパー**: `return jstFunction()` のみ
2. **戻り値が完全に同一**: 同じ引数に対して同じ値を返す
3. **副作用なし**: 削除対象関数は全てピュア関数
4. **型定義は保持**: 既存コンポーネントの型安全性を維持

- [ ] 3. Validate refactor with existing test suite
  - Run all existing E2E tests to ensure zero behavioral changes
  - Verify API responses remain identical
  - Confirm UI rendering stays exactly the same
  - **Validate Availability Consistency Contract**: Ensure therapist cards and calendar displays show identical availability information
  - **Validate Next Available Slot Canonicalization**: Verify `next_available_slot.start_at === availability_slots[0].start_at`
  - _Requirements: 3.1, 3.2, 3.3, 9.4, 9.5_

## Phase 2: Optional Simplification（Phase 1完了後に差分を見て判断）

**注意**: Phase 1完了後の差分レビューで着手判断を行う

- [ ]* 4. Simplify route.ts time calculation logic (Optional)
  - Replace complex time calculation with lib/jst.ts functions
  - Maintain exact same API response format
  - Improve code readability without changing behavior
  - _Requirements: 6.3, 6.4_

- [ ]* 5. Add enhanced error handling (Optional)
  - Implement unified error handling for invalid date inputs
  - Add structured logging for JST operations
  - Create standardized error messages
  - _Requirements: 6.2_

- [ ]* 6. Create JST processing guidelines (Optional)
  - Extend existing prohibition rules in lib/jst.ts
  - Document team-wide JST handling standards
  - Add code review checklist for date/time changes
  - _Requirements: 2.1_

## Phase 3: MVP後の明確なオプション

### Property-Based Testing Suite

- [ ]* 7. Implement comprehensive property-based testing
  - [ ]* 7.1 Create JST edge case boundary testing
    - Generate test cases for leap years, month transitions
    - Add timezone change boundary testing
    - Implement data corruption prevention validation
    - _Requirements: 8.4_

- [ ]* 7.2 Write property test for edge case boundary handling
  - **Property 23: Edge Case Boundary Handling**
  - **Validates: Requirements 8.4**

- [ ]* 7.3 Implement parse-format inverse operation testing
  - Create round-trip testing for parsing and formatting
  - Add precision boundary validation
  - Test format preservation across operations
  - _Requirements: 8.2_

- [ ]* 7.4 Write property test for parse-format inverse operations
  - **Property 22: Parse-Format Inverse Operations**
  - **Validates: Requirements 8.2**

### Enhanced E2E Testing

- [ ]* 8. Extend Playwright E2E test suite for comprehensive JST validation
  - [ ]* 8.1 Add cross-browser JST formatting verification
    - Test JST consistency across different browser environments
    - Validate timezone handling in various user agent configurations
    - Add performance testing for JST operations under load
    - _Requirements: 3.1, 3.4_

- [ ]* 8.2 Create advanced E2E JST edge case testing
  - Test timezone transition scenarios in browser
  - Add leap year and boundary condition E2E validation
  - Implement stress testing for concurrent JST operations
  - _Requirements: 3.4_

- [ ]* 8.3 Implement Availability Consistency Contract E2E validation
  - Test that therapist card availability and calendar availability show identical information
  - Verify "next available time" matches calendar open slots
  - Validate that all UI components derive availability from same backend data
  - **Implement Next Available Slot Canonicalization E2E tests**: Verify `next_available_slot.start_at === availability_slots[0].start_at`
  - **Test complete UI consistency**: Ensure `therapistCard.time === calendar.firstSlot === next_available_slot.start_at`
  - Add cross-component availability consistency checks
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

### Monitoring and Documentation

- [ ]* 9. Create JST monitoring and alerting (Optional)
  - Implement JST-specific error monitoring
  - Add timezone inconsistency detection alerts
  - Create JST operation performance metrics
  - _Requirements: 1.1_

- [ ]* 10. Write comprehensive JST documentation (Optional)
  - Document DateTime Handler API and usage patterns
  - Create migration guide for future codebase changes
  - Add troubleshooting guide for common JST issues
  - _Requirements: 2.1_

- [ ]* 11. Write unit tests for documentation examples (Optional)
  - Validate all code examples in documentation
  - Test migration procedures with sample data
  - Verify troubleshooting solutions work correctly

## Checkpoints

- [ ] 12. Phase 1 Checkpoint - Validate safe refactor completion
  - Ensure all existing tests pass without modification
  - Verify API responses are byte-for-byte identical
  - Confirm UI behavior is completely unchanged
  - **Validate Availability Consistency Contract**: Verify therapist cards and calendar show identical availability
  - Ask user for Phase 2 decision based on diff review

- [ ]* 13. Phase 2 Checkpoint - Optional simplification validation (If Phase 2 executed)
  - Ensure all tests pass after simplification
  - Verify improved code readability
  - Confirm no behavioral regressions

- [ ]* 14. Final Checkpoint - Complete system validation (MVP後)
  - Comprehensive property-based test validation
  - Enhanced E2E test coverage verification
  - Production monitoring and alerting confirmation