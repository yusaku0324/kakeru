# Photo Embeddings System

## Overview

The photo embeddings system enables similarity-based matching between therapists based on their profile photos. This feature represents 60% of the matching algorithm weight and replaces the previous placeholder implementation with real photo embeddings.

## Architecture

### Database Schema

Added three new columns to the `therapists` table:
- `photo_embedding` - ARRAY of floats (512 dimensions)
- `photo_embedding_computed_at` - Timestamp of last computation
- `main_photo_index` - Index of the photo used for embedding

### Components

1. **PhotoEmbeddingService** (`app/domains/site/services/photo_embedding_service.py`)
   - Computes embeddings for photo URLs
   - Manages embedding storage and updates
   - Calculates cosine similarity between embeddings
   - MVP uses deterministic hash-based embeddings

2. **Admin API Endpoints**
   - `POST /api/admin/therapists/embeddings/generate` - Generate embeddings for specific therapists
   - `GET /api/admin/therapists/{therapist_id}/embedding` - Get embedding status
   - `POST /api/admin/therapists/embeddings/batch` - Start background batch processing

3. **Batch Processing Task** (`app/domains/async_tasks/photo_embeddings.py`)
   - Processes therapists without embeddings in batches
   - Supports forced recomputation
   - Cleanup of stale embeddings

4. **Command-Line Tool** (`scripts/manage_embeddings.py`)
   - `compute-all` - Compute embeddings for all therapists
   - `compute-therapist` - Compute for specific therapist
   - `status` - Show embedding statistics
   - `cleanup` - Remove old embeddings

## Usage

### Computing Embeddings

#### Via Admin API
```bash
# Generate for specific therapists
curl -X POST http://localhost:8000/api/admin/therapists/embeddings/generate \
  -H "Content-Type: application/json" \
  -d '{"therapist_ids": ["therapist-uuid"], "force": false}'

# Start batch processing
curl -X POST http://localhost:8000/api/admin/therapists/embeddings/batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 50, "max_total": 1000}'
```

#### Via Command Line
```bash
cd services/api

# Show current status
python scripts/manage_embeddings.py status

# Compute all missing embeddings
python scripts/manage_embeddings.py compute-all --batch-size 100

# Compute for specific therapist
python scripts/manage_embeddings.py compute-therapist <therapist_id> --force

# Cleanup old embeddings
python scripts/manage_embeddings.py cleanup --days-old 30
```

### Integration with Matching

The photo similarity score is automatically computed when matching therapists:

```python
# In guest_matching.py
def _score_photo_similarity(base: dict[str, Any] | None, candidate: dict[str, Any]) -> float:
    # Now uses real embeddings instead of placeholder
    similarity = PhotoEmbeddingService.compute_cosine_similarity(base_vec, cand_vec)
    return max(0.0, similarity)  # Clamp to [0, 1]
```

## Implementation Details

### MVP Embedding Generation

For MVP, embeddings are generated deterministically from photo URLs:
1. SHA256 hash of URL
2. Convert to 512-dimensional vector
3. Normalize to unit vector

This allows testing the full system without requiring a real vision model.

### Production Upgrade Path

To upgrade to real photo embeddings:
1. Replace `compute_embedding_for_photo_url` method
2. Download and process actual images
3. Use vision model (CLIP, ResNet, etc.)
4. Return feature vectors

### Cosine Similarity

Similarity ranges from -1 to 1:
- 1.0 = Identical photos
- 0.0 = Unrelated photos
- -1.0 = Opposite (rare in practice)

For matching, we clamp to [0, 1] range.

## Testing

Run the photo embeddings tests:
```bash
cd services/api
pytest app/tests/test_photo_embeddings.py -v
```

Tests cover:
- Embedding computation
- Deterministic generation
- Cosine similarity calculation
- API endpoints
- Batch processing

## Performance Considerations

- Embeddings are 512 floats = ~2KB per therapist
- Computation is async and can be batched
- Indexed on `photo_embedding_computed_at` for finding unprocessed therapists
- Background tasks prevent blocking API requests

## Future Enhancements

1. **Real Vision Model Integration**
   - Replace deterministic embeddings with actual image processing
   - Consider using CLIP for semantic understanding
   - Cache downloaded images

2. **Multiple Photo Support**
   - Currently uses main photo only
   - Could average embeddings from multiple photos
   - Or keep separate embeddings per photo

3. **Similarity Search Optimization**
   - PostgreSQL cube extension for efficient similarity search
   - Pre-computed similarity matrices for frequent searches
   - Approximate nearest neighbor algorithms

4. **Embedding Versioning**
   - Track embedding model version
   - Support multiple embedding versions
   - Gradual migration between models