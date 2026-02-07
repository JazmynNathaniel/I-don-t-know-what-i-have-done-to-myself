import React from "react";
import { render, screen } from "@testing-library/react";
import App from "../App.jsx";

test("renders app header", () => {
  render(<App />);
  expect(screen.getByText("Job Board")).toBeInTheDocument();
});
