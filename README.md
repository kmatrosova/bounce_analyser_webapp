# Bounce Checker

This project classifies email bounces by identifying both their **source** (e.g. mailbox full, address not found) and **reason** (underlying cause). It supports training, evaluation, and prediction workflows. Each user maintains their own local data structure.

---

## 📂 Project Structure

```
bounce_analyser/
├── config.py
├── data/                        # 🔧 Must be created by the user (not versioned)
│   ├── raw/
│   ├── inference/
│   └── train/
│       ├── preprocessed/
│       │   ├── source/
│       │   └── reason/
│       ├── labels/
│       │   ├── source/
│       │   └── reason/
│       ├── logs/
│       └── predictions/
├── training/
│   └── bounce_trainer.py
├── evaluation/
│   └── evaluator.py
├── inference/
│   └── bounce_inference.py
├── utils.py
├── train.py                     # Training entrypoint
├── evaluate.py                  # Evaluation entrypoint
├── predict.py                   # Inference entrypoint
├── requirements.txt
├── setup.py
├── .env                         # Optional: environment variables (e.g. default paths)
├── .gitignore                   # Excludes data, logs, models, etc.
```

---

## ⚙️ Setup

Install dependencies:

```bash
pip install -r requirements.txt
```

Set up a `.env` file if needed for default paths or keys.

Create a local `data/` folder with this structure:

```
data/
├── raw/
├── inference/
└── train/
    ├── preprocessed/
    │   ├── source/
    │   └── reason/
    ├── labels/
    │   ├── source/
    │   └── reason/
    ├── logs/
    └── predictions/
```

This folder is not tracked in version control and is specific to each user.

---

## 🏋️‍♂️ Training

Train a model for a specific task (`source` or `reason`) and dataset:

```bash
python -m train \
  --model_type <source|reason> \
  --dataset_name <dataset_name>
```

Outputs:
- Model saved in `training/`
- Train/test splits saved in `data/train/labels/`
- Logs saved in `data/train/logs/`

---

## 📊 Evaluation

Evaluate a trained model using its `run_id`:

```bash
python -m evaluate \
  --model_type <source|reason> \
  --dataset_name <dataset_name> \
  --run_id <your_run_id>
```

Predictions are saved in:

```
data/train/predictions/<source|reason>/
```

---

## 🔍 Inference

Classify new bounce messages using a saved model:

```bash
python -m predict \
  --model_type <source|reason> \
  --model_path training/<your_run_id>_<model_type>_model.pkl \
  --input_path data/inference/<your_file>.jsonl
```

Results are saved in the same folder as the input.

---

## ✅ Notes

- Tasks supported: `source`, `reason`
- Each training run generates a timestamped `run_id`
- All paths and settings can be customized in `config.py` or `.env`
- `data/` is user-specific and not included in the repo
