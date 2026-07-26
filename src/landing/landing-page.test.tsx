import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import * as orderRequest from "./order-request"
import { LandingPage } from "./landing-page"

describe("LandingPage", () => {
  it("renders all 60 items and labels sports prices as editorial sample ranges", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(
      screen.getAllByRole("button", { name: /Проверить цену и размер:/ }),
    ).toHaveLength(60)
    expect(screen.getAllByText("по запросу")).toHaveLength(30)
    expect(screen.getAllByText("Рынок РФ*")).toHaveLength(30)
    expect(
      screen.getByText(/Для sport-first позиций указан редакционный диапазон/),
    ).toHaveTextContent("26.07.2026")
    expect(
      screen.getByRole("heading", {
        name: /Все 30 ценовых диапазонов — редакционные ориентиры/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/а не индивидуальная проверка каждой модели или SKU/),
    ).toBeInTheDocument()
  })

  it("states the factual catalog total in the FAQ", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(
      screen.getByText(/Каталог показывает 60 товарных ориентиров/),
    ).toBeInTheDocument()
  })

  it("filters the catalog by product type", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(screen.getByRole("button", { name: "Волейбол" }))

    expect(
      screen.getAllByRole("button", { name: /Проверить цену и размер:/ }),
    ).toHaveLength(18)
    expect(screen.getByText("Найдено: 18")).toBeInTheDocument()
    expect(screen.getByText("SKY ELITE FF 3")).toBeInTheDocument()
  })

  it("recovers from an empty search result", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Быстрый поиск" }),
      "definitely-not-a-product",
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "В подборке такого названия пока нет.",
    )

    await user.click(
      screen.getByRole("button", { name: "Показать все 60 позиций" }),
    )
    expect(
      screen.getAllByRole("button", { name: /Проверить цену и размер:/ }),
    ).toHaveLength(60)
  })

  it("searches by model and prepares a safe demo request", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Быстрый поиск" }),
      "Ronaldinho",
    )
    await user.click(
      screen.getByRole("button", {
        name: /Проверить цену и размер: Nike Football FC Barcelona Ronaldinho/,
      }),
    )

    const dock = screen.getByTestId("order-dock")
    expect(
      within(dock).getByRole("heading", {
        name: /Ronaldinho #10 Jersey/,
      }),
    ).toBeInTheDocument()
    expect(
      (within(dock).getByRole("textbox") as HTMLTextAreaElement).value,
    ).toBe("Nike FC Barcelona Ronaldinho number 10 Jersey")
    expect(within(dock).getByText(/Демо-режим/)).toBeInTheDocument()
    expect(within(dock).queryByText(/VITE_BOT_USERNAME/)).toBeNull()
    expect(within(dock).queryByRole("link", { name: /Открыть @/ })).toBeNull()
  })

  it("shows a visible manual fallback when copying fails", async () => {
    const user = userEvent.setup()
    vi.spyOn(orderRequest, "copyOrderRequest").mockResolvedValueOnce(false)
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      screen.getByRole("button", {
        name: /Проверить цену и размер: ASICS SKY ELITE FF 3/,
      }),
    )
    await user.click(screen.getByRole("button", { name: /Скопировать/ }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Выделите текст выше и скопируйте его вручную.",
    )
  })

  it("shows only a validated HTTPS bot link", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    await user.click(
      screen.getByRole("button", {
        name: /Проверить цену и размер: ASICS SKY ELITE FF 3/,
      }),
    )

    expect(screen.getByRole("link", { name: "Открыть @SelectBuyerBot" })).toHaveAttribute(
      "href",
      "https://t.me/SelectBuyerBot",
    )
  })

  it("closes the request with Escape and restores keyboard focus", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)
    const trigger = screen.getByRole("button", {
      name: /Проверить цену и размер: ASICS SKY ELITE FF 3/,
    })

    await user.click(trigger)
    expect(screen.getByTestId("order-dock")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(screen.queryByTestId("order-dock")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
