"""
seed_exam.py — Create sample exams via API
Run: python seed_exam.py
"""
import requests
from datetime import datetime, timedelta

BASE = "http://localhost:8000/api/v1"

# Login as admin
r = requests.post(f"{BASE}/auth/login", json={
    "email": "admin@proctor.com",
    "password": "admin123"
})
assert r.status_code == 200, f"Login failed: {r.text}"
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

now = datetime.utcnow()

# Create 3 sample exams
exams = [
    {
        "title": "Python Programming Midterm",
        "description": "Covers OOP, functions, and data structures",
        "duration_minutes": 90,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=3)).isoformat(),
        "max_alerts": 8,
        "questions": [
            {"id": 1, "type": "mcq", "marks": 5,
             "text": "Which keyword is used to define a function in Python?",
             "options": ["func", "def", "function", "lambda"], "answer": "def"},
            {"id": 2, "type": "mcq", "marks": 5,
             "text": "What is the output of type([])?",
             "options": ["list", "<class 'list'>", "array", "None"], "answer": "<class 'list'>"},
            {"id": 3, "type": "text", "marks": 10,
             "text": "Explain the difference between a list and a tuple in Python."},
            {"id": 4, "type": "text", "marks": 10,
             "text": "Write a Python function to reverse a string without using built-in reverse()."},
            {"id": 5, "type": "mcq", "marks": 5,
             "text": "Which of these is immutable?",
             "options": ["list", "dict", "tuple", "set"], "answer": "tuple"},
        ]
    },
    {
        "title": "Database Systems Final Exam",
        "description": "SQL, normalization, transactions, indexing",
        "duration_minutes": 120,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=4)).isoformat(),
        "max_alerts": 6,
        "questions": [
            {"id": 1, "type": "mcq", "marks": 5,
             "text": "Which SQL statement is used to retrieve data?",
             "options": ["GET", "SELECT", "FETCH", "READ"], "answer": "SELECT"},
            {"id": 2, "type": "text", "marks": 15,
             "text": "Explain the ACID properties of database transactions with examples."},
            {"id": 3, "type": "text", "marks": 10,
             "text": "What is the difference between INNER JOIN and LEFT JOIN?"},
            {"id": 4, "type": "mcq", "marks": 5,
             "text": "In which normal form is a relation if it has no partial dependencies?",
             "options": ["1NF", "2NF", "3NF", "BCNF"], "answer": "2NF"},
            {"id": 5, "type": "text", "marks": 15,
             "text": "Write an SQL query to find the second highest salary from an Employee table."},
        ]
    },
    {
        "title": "Computer Networks Quiz",
        "description": "OSI model, TCP/IP, routing protocols",
        "duration_minutes": 45,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
        "max_alerts": 5,
        "questions": [
            {"id": 1, "type": "mcq", "marks": 5,
             "text": "How many layers does the OSI model have?",
             "options": ["4", "5", "6", "7"], "answer": "7"},
            {"id": 2, "type": "mcq", "marks": 5,
             "text": "Which layer is responsible for routing?",
             "options": ["Transport", "Network", "Data Link", "Session"], "answer": "Network"},
            {"id": 3, "type": "text", "marks": 10,
             "text": "Explain the difference between TCP and UDP with use cases for each."},
            {"id": 4, "type": "text", "marks": 10,
             "text": "What is subnetting? Calculate the subnet mask for /26."},
        ]
    }
]

for exam_data in exams:
    r = requests.post(f"{BASE}/exams/", json=exam_data, headers=headers)
    if r.status_code == 201:
        print(f"✅ Created: {exam_data['title']} (ID: {r.json()['id']})")
    else:
        print(f"❌ Failed: {exam_data['title']} — {r.text}")

print("\nDone! Open http://localhost:5173 and login as student to take exams.")
