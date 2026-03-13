const fetch = require("node-fetch");
const { Router } = require("express");
const router = Router();

router.get("/api/vin/:vin", async (req, res) => {
  try {
    const { vin } = req.params;
    if (!vin || vin.length !== 17) {
      return res.status(400).json({ success: false, error: "VIN must be exactly 17 characters" });
    }

    const resp = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );
    const raw = await resp.json();

    const fields = {};
    for (const r of raw.Results || []) {
      if (r.Value && r.Value.trim() !== "" && r.Variable) {
        fields[r.Variable] = r.Value.trim();
      }
    }

    res.json({
      success: true,
      data: {
        vin,
        year: fields["Model Year"] || null,
        make: fields["Make"] || null,
        model: fields["Model"] || null,
        trim: fields["Trim"] || null,
        bodyClass: fields["Body Class"] || null,
        driveType: fields["Drive Type"] || null,
        fuelType: fields["Fuel Type - Primary"] || null,
        engineCylinders: fields["Engine Number of Cylinders"] || null,
        engineDisplacement: fields["Displacement (L)"] || null,
        transmissionStyle: fields["Transmission Style"] || null,
        plantCountry: fields["Plant Country"] || null,
        vehicleType: fields["Vehicle Type"] || null,
      },
      source: "NHTSA vPIC API",
    });
  } catch (err) {
    res.status(502).json({ success: false, error: "Upstream API error", details: err.message });
  }
});

module.exports = router;
