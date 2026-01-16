#!/usr/bin/env python3
"""
Score benchmark results against ground truth.

Usage:
    python scripts/score_models.py data/benchmark/metadata_TIMESTAMP.json
"""

import sys
import json
from pathlib import Path
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class ModelScore:
    """Scores for a single model."""
    model_name: str
    product_count_score: float
    price_accuracy_score: float
    field_completeness_score: float
    discount_accuracy_score: float
    date_accuracy_score: float
    italian_text_score: float
    total_score: float
    products_found: int
    products_expected: int
    prices_correct: int
    fields_filled: int
    fields_total: int


def load_ground_truth() -> Dict:
    """Load the ground truth JSON."""
    gt_path = Path("data/benchmark/ground_truth.json")
    if not gt_path.exists():
        print(f"❌ Ground truth not found: {gt_path}")
        print("   Create it with your expected output")
        sys.exit(1)
    
    with open(gt_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_model_results(metadata_file: str) -> Dict[str, Dict]:
    """Load all model outputs for this benchmark run."""
    metadata_path = Path(metadata_file)
    
    if not metadata_path.exists():
        print(f"❌ Metadata file not found: {metadata_file}")
        sys.exit(1)
    
    with open(metadata_path, encoding='utf-8') as f:
        metadata = json.load(f)
    
    timestamp = metadata['timestamp']
    benchmark_dir = metadata_path.parent
    
    results = {}
    for model_name in metadata['models_tested']:
        safe_name = model_name.replace('/', '_').replace(':', '_')
        result_file = benchmark_dir / f"{safe_name}_{timestamp}.json"
        
        if result_file.exists():
            with open(result_file, 'r', encoding='utf-8') as f:
                try:
                    results[model_name] = json.load(f)
                except json.JSONDecodeError:
                    print(f"⚠️  Failed to parse JSON for {model_name}")
                    results[model_name] = None
        else:
            print(f"⚠️  Missing result file: {result_file}")
            results[model_name] = None
    
    return results


def score_product_count(model_output: Dict, ground_truth: Dict) -> float:
    """Score: How many products were found vs expected?"""
    if not model_output:
        return 0.0
    
    expected_count = len(ground_truth['products'])
    found_count = len(model_output.get('products', []))
    
    if expected_count == 0:
        return 1.0 if found_count == 0 else 0.0
    
    # Perfect match = 1.0, proportional penalty for difference
    diff = abs(expected_count - found_count)
    return max(0.0, 1.0 - (diff * 0.15))  # -0.15 per product difference


def score_prices(model_output: Dict, ground_truth: Dict) -> tuple:
    """Score: Are prices accurate?"""
    if not model_output:
        return 0.0, 0, 0
    
    gt_products = {p['name']: p for p in ground_truth['products']}
    model_products = {p.get('name'): p for p in model_output.get('products', []) if p.get('name')}
    
    correct = 0
    total = 0
    
    for name, gt_product in gt_products.items():
        if name in model_products:
            total += 1
            model_price = model_products[name].get('current_price')
            gt_price = gt_product.get('current_price')
            
            if model_price == gt_price:
                correct += 1
            elif model_price and gt_price:
                # Allow small floating point differences
                try:
                    if abs(float(model_price) - float(gt_price)) < 0.01:
                        correct += 1
                except (ValueError, TypeError):
                    pass
    
    score = correct / total if total > 0 else 0.0
    return score, correct, total


def score_field_completeness(model_output: Dict, ground_truth: Dict) -> tuple:
    """Score: How many fields are filled?"""
    if not model_output:
        return 0.0, 0, 0
    
    fields_to_check = [
        'brand', 'name', 'description', 'current_price', 'old_price',
        'discount', 'weight_or_pack', 'price_per_unit',
        'offer_start_date', 'offer_end_date', 'notes'
    ]
    
    filled = 0
    total = 0
    
    gt_products = {p['name']: p for p in ground_truth['products']}
    model_products = {p.get('name'): p for p in model_output.get('products', []) if p.get('name')}
    
    for name, gt_product in gt_products.items():
        if name in model_products:
            model_product = model_products[name]
            # Only check fields that are non-null in ground truth
            for field in fields_to_check:
                if gt_product.get(field) is not None:
                    total += 1
                    if model_product.get(field) is not None:
                        filled += 1
    
    score = filled / total if total > 0 else 0.0
    return score, filled, total


def score_discounts(model_output: Dict, ground_truth: Dict) -> float:
    """Score: Are discount percentages correct?"""
    if not model_output:
        return 0.0
    
    gt_products = {p['name']: p for p in ground_truth['products']}
    model_products = {p.get('name'): p for p in model_output.get('products', []) if p.get('name')}
    
    correct = 0
    total = 0
    
    for name, gt_product in gt_products.items():
        gt_discount = gt_product.get('discount')
        if not gt_discount:  # Skip products without discounts
            continue
        
        if name in model_products:
            total += 1
            model_discount = model_products[name].get('discount')
            
            if model_discount == gt_discount:
                correct += 1
            elif model_discount and gt_discount:
                # Extract percentages and compare
                import re
                gt_pct_match = re.search(r'(\d+)', str(gt_discount))
                model_pct_match = re.search(r'(\d+)', str(model_discount))
                
                if gt_pct_match and model_pct_match:
                    gt_pct = int(gt_pct_match.group(1))
                    model_pct = int(model_pct_match.group(1))
                    
                    if abs(gt_pct - model_pct) <= 1:  # Allow 1% difference
                        correct += 1
    
    return correct / total if total > 0 else 0.0


def score_dates(model_output: Dict, ground_truth: Dict) -> float:
    """Score: Are dates accurate?"""
    if not model_output:
        return 0.0
    
    gt_products = {p['name']: p for p in ground_truth['products']}
    model_products = {p.get('name'): p for p in model_output.get('products', []) if p.get('name')}
    
    correct = 0
    total = 0
    
    for name, gt_product in gt_products.items():
        if name in model_products:
            model_product = model_products[name]
            
            # Check start date
            if gt_product.get('offer_start_date'):
                total += 1
                if model_product.get('offer_start_date') == gt_product['offer_start_date']:
                    correct += 1
            
            # Check end date
            if gt_product.get('offer_end_date'):
                total += 1
                if model_product.get('offer_end_date') == gt_product['offer_end_date']:
                    correct += 1
    
    return correct / total if total > 0 else 0.0


def score_italian_text(model_output: Dict, ground_truth: Dict) -> float:
    """Score: Did it preserve Italian text correctly?"""
    if not model_output:
        return 0.0
    
    italian_phrases = [
        "Coltivato in Italia",
        "Allevato in Italia",
        "confezione",
        "arrosto",
        "frollini",
        "ripieno",
        "forno"
    ]
    
    # Collect all text from model output
    all_text = json.dumps(model_output, ensure_ascii=False).lower()
    
    found = sum(1 for phrase in italian_phrases if phrase.lower() in all_text)
    
    return found / len(italian_phrases)


def calculate_total_score(scores: Dict[str, float]) -> float:
    """Weighted total score."""
    weights = {
        'product_count': 0.30,
        'price_accuracy': 0.25,
        'field_completeness': 0.15,
        'discount_accuracy': 0.15,
        'date_accuracy': 0.10,
        'italian_text': 0.05
    }
    
    total = sum(scores[key] * weights[key] for key in weights)
    return round(total, 3)


def score_model(model_name: str, model_output: Dict, ground_truth: Dict) -> ModelScore:
    """Score a single model's output."""
    if not model_output or not model_output.get('products'):
        return ModelScore(
            model_name=model_name,
            product_count_score=0.0,
            price_accuracy_score=0.0,
            field_completeness_score=0.0,
            discount_accuracy_score=0.0,
            date_accuracy_score=0.0,
            italian_text_score=0.0,
            total_score=0.0,
            products_found=0,
            products_expected=len(ground_truth['products']),
            prices_correct=0,
            fields_filled=0,
            fields_total=0
        )
    
    # Calculate all scores
    product_count_score = score_product_count(model_output, ground_truth)
    price_score, prices_correct, prices_total = score_prices(model_output, ground_truth)
    completeness_score, fields_filled, fields_total = score_field_completeness(model_output, ground_truth)
    discount_score = score_discounts(model_output, ground_truth)
    date_score = score_dates(model_output, ground_truth)
    italian_score = score_italian_text(model_output, ground_truth)
    
    scores_dict = {
        'product_count': product_count_score,
        'price_accuracy': price_score,
        'field_completeness': completeness_score,
        'discount_accuracy': discount_score,
        'date_accuracy': date_score,
        'italian_text': italian_score
    }
    
    total = calculate_total_score(scores_dict)
    
    return ModelScore(
        model_name=model_name,
        product_count_score=product_count_score,
        price_accuracy_score=price_score,
        field_completeness_score=completeness_score,
        discount_accuracy_score=discount_score,
        date_accuracy_score=date_score,
        italian_text_score=italian_score,
        total_score=total,
        products_found=len(model_output.get('products', [])),
        products_expected=len(ground_truth['products']),
        prices_correct=prices_correct,
        fields_filled=fields_filled,
        fields_total=fields_total
    )


def print_leaderboard(scores: List[ModelScore]):
    """Print formatted leaderboard."""
    # Sort by total score descending
    sorted_scores = sorted(scores, key=lambda s: s.total_score, reverse=True)
    
    print("\n" + "="*100)
    print("🏆 MODEL BENCHMARK RESULTS - LEADERBOARD")
    print("="*100)
    
    # Header
    print(f"\n{'Rank':<6} {'Model':<45} {'Total':<8} {'Products':<10} {'Prices':<8} {'Fields':<8}")
    print("-" * 100)
    
    # Rows
    for rank, score in enumerate(sorted_scores, 1):
        medal = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else "  "
        
        model_short = score.model_name.split('/')[-1][:40]  # Truncate long names
        
        print(f"{medal} #{rank:<3} {model_short:<45} "
              f"{score.total_score:.3f}   "
              f"{score.products_found}/{score.products_expected}      "
              f"{score.price_accuracy_score:.2f}     "
              f"{score.field_completeness_score:.2f}")
    
    print("\n" + "="*100)
    print("DETAILED BREAKDOWN")
    print("="*100)
    
    for rank, score in enumerate(sorted_scores, 1):
        print(f"\n#{rank} {score.model_name}")
        print("-" * 80)
        print(f"  Product Count:      {score.product_count_score:.2f}  ({score.products_found}/{score.products_expected} products)")
        print(f"  Price Accuracy:     {score.price_accuracy_score:.2f}  ({score.prices_correct} correct)")
        print(f"  Field Completeness: {score.field_completeness_score:.2f}  ({score.fields_filled}/{score.fields_total} fields)")
        print(f"  Discount Accuracy:  {score.discount_accuracy_score:.2f}")
        print(f"  Date Accuracy:      {score.date_accuracy_score:.2f}")
        print(f"  Italian Text:       {score.italian_text_score:.2f}")
        print(f"  TOTAL SCORE:        {score.total_score:.3f}")
    
    print("\n" + "="*100)
    winner = sorted_scores[0]
    print(f"✨ WINNER: {winner.model_name} with score {winner.total_score:.3f}")
    print("="*100 + "\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/score_models.py data/benchmark/metadata_TIMESTAMP.json")
        sys.exit(1)
    
    metadata_file = sys.argv[1]
    
    print("📊 Loading benchmark results...")
    ground_truth = load_ground_truth()
    model_results = load_model_results(metadata_file)
    
    print(f"✅ Ground truth: {len(ground_truth['products'])} products")
    print(f"✅ Models to score: {len(model_results)}\n")
    
    # Score each model
    all_scores = []
    for model_name, model_output in model_results.items():
        print(f"Scoring: {model_name}...")
        score = score_model(model_name, model_output, ground_truth)
        all_scores.append(score)
    
    # Print leaderboard
    print_leaderboard(all_scores)
    
    # Save scores to JSON
    scores_file = Path(metadata_file).parent / f"scores_{Path(metadata_file).stem.replace('metadata_', '')}.json"
    with open(scores_file, 'w', encoding='utf-8') as f:
        json.dump([vars(s) for s in all_scores], f, indent=2, ensure_ascii=False)
    
    print(f"💾 Scores saved to: {scores_file}")


if __name__ == '__main__':
    main()
