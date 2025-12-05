# train_xgb.py
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib, os

def train(csv_path="ml_data/ml_data.csv", out_model="ml_models/xgb_model.joblib"):
    df = pd.read_csv(csv_path)
    if 'label' not in df.columns:
        raise RuntimeError("No label column found")
    X = df.drop(columns=['label']).fillna(0)
    y = df['label']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    clf = xgb.XGBClassifier(n_estimators=200, max_depth=6, use_label_encoder=False, eval_metric='mlogloss')
    clf.fit(X_train, y_train)
    preds = clf.predict(X_test)
    print("Accuracy:", accuracy_score(y_test, preds))
    print(classification_report(y_test, preds))
    os.makedirs(os.path.dirname(out_model), exist_ok=True)
    joblib.dump(clf, out_model)
    print("Saved model to", out_model)

if __name__ == "__main__":
    train()
