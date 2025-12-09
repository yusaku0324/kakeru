## Summary
<!-- What does this PR do? Keep it concise (1-3 sentences) -->


## Type of Change
<!-- Check all that apply -->
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] CI/CD or infrastructure change

## Checklist

### General
- [ ] I have tested my changes locally
- [ ] I have added/updated tests as needed
- [ ] My code follows the project's coding style

### Database Changes
<!-- If you made DB changes, check these -->
- [ ] **No database changes in this PR**
- [ ] New migration file added (`alembic revision`)
- [ ] Migration is reversible (has proper `downgrade()`)
- [ ] Enum changes are reflected in both `models.py` AND `schemas.py`
- [ ] Existing data will not be corrupted by this migration

### Dependencies
<!-- If you changed requirements.txt or package.json -->
- [ ] **No dependency changes in this PR**
- [ ] New dependency added to `requirements.txt` / `package.json`
- [ ] Dependency is required (not optional) - added to main requirements
- [ ] Dependency is optional - wrapped in try/except with graceful fallback
- [ ] Tested in clean environment (not just local with pre-existing packages)

### API Changes
- [ ] **No API changes in this PR**
- [ ] New endpoint added - documented in code/comments
- [ ] Endpoint signature changed - checked all callers
- [ ] Response schema changed - updated frontend if needed

### Environment Variables
- [ ] **No env var changes in this PR**
- [ ] New env var added to `.env.example`
- [ ] New env var added to Doppler (dev/stg/prod)
- [ ] Code handles missing env var gracefully

## Test Plan
<!-- How did you test this? What should reviewers check? -->


## Related Issues
<!-- Link any related issues: Fixes #123, Related to #456 -->
