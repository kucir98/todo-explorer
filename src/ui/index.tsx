import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ComponentContext, IComponent, getStudioProApi } from "@mendix/extensions-api";
import { App } from "./App";
import { css } from "./styles";

export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);
        const { theme } = await studioPro.ui.preferences.getPreferences();
        document.documentElement.dataset.theme = theme === "Dark" ? "dark" : "light";
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <App studioPro={studioPro} />
            </StrictMode>
        );
    }
};
