"""
Script to create proper test images for video generation
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_test_images():
    """Create test images with questions for video generation"""
    os.makedirs('test_images', exist_ok=True)
    
    questions = [
        'メンズエステで働くメリットは何でしょうか？',
        '未経験でも稼げるのでしょうか？',
        '出稼ぎの交通費は支給されるのでしょうか？',
        '本指名率を上げるコツはありますか？'
    ]
    
    for i, question in enumerate(questions, 1):
        img = Image.new('RGB', (1920, 1080), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 60)
        except:
            font = ImageFont.load_default()
        
        text_bbox = draw.textbbox((0, 0), question, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        x = (1920 - text_width) // 2
        y = (1080 - text_height) // 2
        
        draw.text((x, y), question, fill='black', font=font)
        
        img.save(f'test_images/question_{i}.png')
        print(f'Created test_images/question_{i}.png')

if __name__ == "__main__":
    create_test_images()
