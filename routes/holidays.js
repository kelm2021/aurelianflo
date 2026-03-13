const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

// This must come BEFORE /:country/:year to avoid "today" matching as a country
router.get("/api/holidays/today/:country", async (req, res) => {
  try {
    const { country } = req.params;
    const today = new Date().toISOString().split("T")[0];
    const year = new Date().getFullYear();

    const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country.toUpperCase()}`);
    if (!resp.ok) {
      return res.status(400).json({ success: false, error: `No data for ${country}. Use ISO 3166-1 alpha-2 codes.` });
    }

    const holidays = await resp.json();
    const todayHoliday = holidays.find((h) => h.date === today);

    const dayOfWeek = new Date().getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const next = holidays.find((h) => h.date > today);

    res.json({
      success: true,
      data: {
        country: country.toUpperCase(),
        date: today,
        isHoliday: !!todayHoliday,
        isWeekend,
        isBusinessDay: !todayHoliday && !isWeekend,
        holiday: todayHoliday
          ? { name: todayHoliday.name, localName: todayHoliday.localName, types: todayHoliday.types }
          : null,
        nextHoliday: next ? { date: next.date, name: next.name } : null,
      },
      source: "Nager.Date API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

router.get("/api/holidays/:country/:year", async (req, res) => {
  try {
    const { country, year } = req.params;
    const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country.toUpperCase()}`);

    if (!resp.ok) {
      return res.status(400).json({ success: false, error: `No data for ${country}/${year}. Use ISO 3166-1 alpha-2 codes.` });
    }

    const holidays = await resp.json();

    res.json({
      success: true,
      data: {
        country: country.toUpperCase(),
        year: parseInt(year),
        count: holidays.length,
        holidays: holidays.map((h) => ({
          date: h.date,
          name: h.name,
          localName: h.localName,
          types: h.types,
          global: h.global,
        })),
      },
      source: "Nager.Date API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
