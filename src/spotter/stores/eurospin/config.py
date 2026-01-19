EUROSPIN_CONFIG = {
    "store_key": "eurospin",
    "retailer": "Eurospin",
    "flyer_url": "https://www.eurospin.it/volantino-store-eurospin/?codice_pv=467720",
    # Cookie banner: Iubenda - use accept button to dismiss
    "cookie_selectors": [
        "button.iubenda-cs-accept-btn",
        ".iubenda-cs-accept-btn",
        "button.iubenda-cs-close-btn",
        "button:has-text('Accetta tutto')",
        "button:has-text('Accetta')",
    ],
    # Flyer is in iframe: iframe[src*='smt-digitalflyer']
    "iframe_selector": "iframe[src*='smt-digitalflyer']",
    # Navigation buttons inside iframe (Material Icons text)
    "next_button_selectors": [
        "button:has-text('arrow_forward_ios')",
        "button:has-text('chevron_right')",
        "button[aria-label='Pagina successiva']",
        "button[aria-label='Avanti']",
        "button.next-button",
        ".next-button",
    ],
    "page_input_selectors": [],
    "page_indicator_selectors": [],
    "page_limit": 3,
    "page_limit_full": None
}
