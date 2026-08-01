import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Header } from "./header"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, "", "/")
})

describe("Header SMS login", () => {
  it("keeps the primary storefront destinations available in the navigation landmark", () => {
    render(
      <Header
        cartCount={0}
        openCart={vi.fn()}
        personalDataConsentVersion="pd-2026-08"
        refreshPersonalDataConsentVersion={vi.fn()}
      />,
    )

    const navigation = screen.getByRole("navigation", { name: "Основная навигация" })
    expect(within(navigation).getByRole("link", { name: "Каталог" })).toHaveAttribute(
      "href",
      "/#catalog",
    )
    expect(within(navigation).getByRole("link", { name: "Подобрать" })).toHaveAttribute(
      "href",
      "/#selection",
    )
    expect(
      within(navigation).getByRole("link", { name: "Доставка и возврат" }),
    ).toHaveAttribute("href", "/delivery-returns")
  })

  it("sends the public consent version supplied by the backend", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      status: 202,
      json: async () => ({ challenge_id: "sms-1", message: "Код отправлен." }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <Header
        cartCount={0}
        openCart={vi.fn()}
        personalDataConsentVersion="pd-2026-08"
        refreshPersonalDataConsentVersion={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Войти" }))
    await user.type(screen.getByRole("textbox", { name: "Телефон" }), "+79990000000")
    await user.click(
      screen.getByRole("checkbox", { name: /Согласен на обработку телефона/i }),
    )
    await user.click(screen.getByRole("button", { name: "Получить код" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const request = fetchMock.mock.calls[0]?.[1] as { body?: string }
    expect(JSON.parse(request.body || "{}")).toMatchObject({
      phone: "+79990000000",
      personal_data_accepted: true,
      consent_version: "pd-2026-08",
    })
  })

  it("does not request an SMS when the backend version is unavailable", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    render(
      <Header
        cartCount={0}
        openCart={vi.fn()}
        personalDataConsentVersion={null}
        refreshPersonalDataConsentVersion={vi.fn().mockResolvedValue(null)}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Войти" }))
    await user.type(screen.getByRole("textbox", { name: "Телефон" }), "+79990000000")
    await user.click(
      screen.getByRole("checkbox", { name: /Согласен на обработку телефона/i }),
    )
    await user.click(screen.getByRole("button", { name: "Получить код" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис входа временно недоступен",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
