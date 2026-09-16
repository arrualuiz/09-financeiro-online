// Comunicação com a API do Google Sheets (v4).

const SheetsAPI = (() => {
  async function fetchRange(range) {
    const { SPREADSHEET_ID } = window.APP_CONFIG;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AUTH.getToken()}` },
    });

    if (res.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erro ao buscar dados da planilha (${res.status}): ${body}`);
    }

    const data = await res.json();
    return data.values || [];
  }

  return { fetchRange };
})();
