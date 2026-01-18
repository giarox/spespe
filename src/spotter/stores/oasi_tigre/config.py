OASI_TIGRE_CONFIG = {
    "store_key": "oasi_tigre",
    "retailer": "Oasi Tigre",
    "flyer_url": "https://www.calameo.com/read/001940002c37e14603a0d?view=scroll&page=1",
    "cookie_selectors": [
        "button#onetrust-reject-all-handler",
        "button:has-text('Rifiuta tutto')",
        "button:has-text('Rifiuta')",
        "button:has-text('Continua senza')"
    ],
    "next_button_selectors": [],
    "page_indicator_selectors": [
        ".skin-tag.skin-pagenumber input[name='pageNumber']",
        ".skin-tag.skin-pagenumber .total"
    ]
}
