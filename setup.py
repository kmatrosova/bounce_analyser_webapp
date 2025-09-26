# setup.py
from setuptools import setup, find_packages

def read_requirements():
    with open('requirements.txt', 'r') as f:
        return [line.strip() for line in f 
                if line.strip() and not line.startswith('#')]

setup(
    name="bounce_analyser",
    version="0.1.0",
    packages=find_packages(),
    install_requires=read_requirements(),
    python_requires=">=3.8",
)