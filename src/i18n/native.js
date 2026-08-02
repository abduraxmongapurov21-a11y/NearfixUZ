import React, { forwardRef } from "react";
import { Alert as NativeAlert, Text as NativeText, TextInput as NativeTextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { translateCopy } from "./index";

function translateNode(node) {
  if (typeof node === "string") return translateCopy(node);
  if (Array.isArray(node)) return node.map(translateNode);
  return node;
}

export const Text = forwardRef(function LocalizedText({ children, translate = true, ...props }, ref) {
  useTranslation();
  const translatedChildren = translate ? translateNode(children) : children;
  return (
    <NativeText ref={ref} {...props}>
      {translatedChildren}
    </NativeText>
  );
});

export const TextInput = forwardRef(function LocalizedTextInput(
  { placeholder, accessibilityLabel, accessibilityHint, ...props },
  ref
) {
  useTranslation();
  return (
    <NativeTextInput
      ref={ref}
      placeholder={translateCopy(placeholder)}
      accessibilityLabel={translateCopy(accessibilityLabel)}
      accessibilityHint={translateCopy(accessibilityHint)}
      {...props}
    />
  );
});

function translateButtons(buttons) {
  return buttons?.map((button) => ({ ...button, text: translateCopy(button.text) }));
}

export const Alert = Object.freeze({
  alert(title, message, buttons, options) {
    return NativeAlert.alert(translateCopy(title), translateCopy(message), translateButtons(buttons), options);
  },
  prompt(title, message, callbackOrButtons, type, defaultValue, keyboardType, options) {
    const callbacks = Array.isArray(callbackOrButtons) ? translateButtons(callbackOrButtons) : callbackOrButtons;
    return NativeAlert.prompt(
      translateCopy(title),
      translateCopy(message),
      callbacks,
      type,
      defaultValue,
      keyboardType,
      options
    );
  }
});
