import { describe, expect, it } from "vitest";
import { farewellReply, isFarewell } from "@/features/ai/farewell";

describe("voice farewells", () => {
  it("recognizes goodbyes, thanks and closing phrases", () => {
    for (const phrase of ["No, gracias.", "gracias", "Muchas gracias", "adiós", "chao", "hasta luego", "eso es todo", "nada más", "listo", "ya está", "ciérrate", "buenas noches"]) {
      expect(isFarewell(phrase), phrase).toBe(true);
    }
  });

  it("does not mistake real orders for farewells", () => {
    for (const phrase of ["pon música de Coldplay", "gracias a la vida de Mercedes Sosa", "busca el video de adiós amor", "¿qué clima hace?", "listo para escuchar vallenato"]) {
      expect(isFarewell(phrase), phrase).toBe(false);
    }
  });

  it("answers briefly according to persona", () => {
    expect(farewellReply("No, gracias.", "jarvis")).toBe("A sus órdenes, señor. Quedo disponible.");
    expect(farewellReply("buenas noches", "jarvis")).toBe("Buenas noches, señor. Quedo disponible.");
    expect(farewellReply("adiós", "copiloto")).toBe("Listo. Aquí estaré.");
    expect(farewellReply("gracias", "kitt")).toBe("Para eso estoy, señor. Conduzca con cuidado.");
    expect(farewellReply("adiós", "piloto")).toBe("Recibido. Copiloto en espera.");
  });
});
