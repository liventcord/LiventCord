import sys

from icrawler.builtin import GoogleImageCrawler


def crawl(query: str, max_num: int = 3) -> None:
    google_crawler = GoogleImageCrawler()
    google_crawler.crawl(keyword=query, max_num=max_num)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = sys.argv[1]
        max_num = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 3
        crawl(query, max_num)
    else:
        print("Error: No query provided.")
