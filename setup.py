from setuptools import setup, find_packages

setup(
    name="kakeru",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pyyaml",
        "selenium",
        "undetected-chromedriver",
    ],
)
