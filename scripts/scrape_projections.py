#!/usr/bin/env python3
"""
Scrape Fantasy Football Pundit's Points Predictor using Playwright.
https://www.fantasyfootballpundit.com/fpl-points-predictor/
"""

import json
import asyncio
from playwright.async_api import async_playwright

async def scrape_projections():
    print("🚀 Starting Playwright browser...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        print("📄 Loading Fantasy Football Pundit page...")
        
        try:
            await page.goto('https://www.fantasyfootballpundit.com/fpl-points-predictor/', 
                          wait_until='domcontentloaded', timeout=60000)
            print("✅ DOM loaded!")
        except Exception as e:
            print(f"⚠️ Page load issue: {e}")
        
        # Wait longer for JavaScript to populate the table
        print("⏳ Waiting 10s for table data to load...")
        await asyncio.sleep(10)
        
        # Try scrolling to trigger lazy loading
        await page.evaluate("window.scrollTo(0, 500)")
        await asyncio.sleep(2)
        
        # Look for the actual data - they might use a specific table library
        print("🔍 Searching for table data...")
        
        # Try DataTables format (common for FPL sites)
        try:
            # Get all text from the page to see what loaded
            page_text = await page.content()
            
            # Check for player names we know should be there
            test_players = ['Salah', 'Haaland', 'Palmer', 'Saka']
            for player in test_players:
                if player in page_text:
                    print(f"  ✅ Found {player} in page!")
                else:
                    print(f"  ❌ {player} not found")
            
            # Try to find DataTables API
            data = await page.evaluate('''() => {
                // Check for jQuery DataTables
                if (typeof $ !== 'undefined' && $.fn && $.fn.dataTable) {
                    const tables = $('table').DataTable();
                    if (tables && tables.data) {
                        return tables.data().toArray();
                    }
                }
                
                // Try to get table data directly
                const rows = document.querySelectorAll('table tbody tr');
                const data = [];
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 0) {
                        data.push({
                            name: cells[0]?.innerText || '',
                            team: cells[1]?.innerText || '',
                            predicted_points: cells[2]?.innerText || '',
                            start_pct: cells[3]?.innerText || '',
                            fixture: cells[4]?.innerText || '',
                            price: cells[5]?.innerText || '',
                            pick_pct: cells[6]?.innerText || ''
                        });
                    }
                });
                return data;
            }''')
            
            if data and len(data) > 0:
                # Filter out empty entries
                valid_data = [p for p in data if p.get('name') and p.get('name').strip()]
                
                if valid_data:
                    print(f"\n✅ Extracted {len(valid_data)} players!")
                    print("\n📊 Top 15 projected players:")
                    for p in valid_data[:15]:
                        print(f"  {p.get('name', 'Unknown'):25} | {p.get('predicted_points', 'N/A'):5} pts | {p.get('team', 'N/A')}")
                    
                    # Save full data
                    print(f"\n💾 Saving {len(valid_data)} players to projections.json...")
                    with open('scripts/projections.json', 'w') as f:
                        json.dump(valid_data, f, indent=2)
                else:
                    print("❌ No valid player data extracted")
            else:
                print("❌ No table data found")
                
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Take a screenshot for debugging
        await page.screenshot(path='scripts/debug_screenshot.png')
        print("📸 Saved debug screenshot")
        
        await browser.close()
        print("\n✅ Done!")

if __name__ == "__main__":
    asyncio.run(scrape_projections())
