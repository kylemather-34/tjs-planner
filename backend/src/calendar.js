// calendar.js
//
// Builds a standard .ics file with one all-day-ish dinner event per day,
// starting from a given date. Import it into Google/Apple/Outlook calendar.

export function buildIcs(weeklyPlan, { startDate = new Date(), hour = 18 } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//hagplanid-tj//meal-plan//EN",
  ];

  weeklyPlan.days.forEach((day, i) => {
    const start = new Date(startDate);
    start.setDate(start.getDate() + i);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1);

    const items = day.lineItems
      .filter((li) => li.product)
      .map((li) => `${li.product.title} x${li.qty}`)
      .join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${day.id}-${start.getTime()}@hagplanid-tj`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:Dinner: ${day.recipe}`,
      `DESCRIPTION:${items}\\nEst. cost: $${day.dayTotal.toFixed(2)}`,
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function toIcsDate(d) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
