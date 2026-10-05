import { createContext, useContext, useState } from 'react'
import { templateDefaultConfig, resolveConfig, findTemplate } from '../config/customize'

const CUSTOM_TEMPLATES_KEY = 'tpl_custom_templates'
const SELECTED_CONFIG_KEY = 'tpl_selected_config'

function loadCustomTemplates() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TEMPLATES_KEY) || '[]')
  } catch {
    return []
  }
}

function loadSelectedConfig() {
  try {
    return JSON.parse(localStorage.getItem(SELECTED_CONFIG_KEY) || 'null')
  } catch {
    return null
  }
}

const TemplateContext = createContext(null)

export function TemplateProvider({ children }) {
  const [selectedConfig, setSelectedConfig] = useState(loadSelectedConfig)
  const [customTemplates, setCustomTemplates] = useState(loadCustomTemplates)

  const persistCustomTemplates = (list) => {
    setCustomTemplates(list)
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list))
  }

  const selectTemplate = (templateId) => {
    const template = findTemplate(templateId)
    const config = templateDefaultConfig(template)
    setSelectedConfig(config)
    localStorage.setItem(SELECTED_CONFIG_KEY, JSON.stringify(config))
  }

  const applyConfig = (config) => {
    const resolved = resolveConfig(config)
    setSelectedConfig(resolved)
    localStorage.setItem(SELECTED_CONFIG_KEY, JSON.stringify(resolved))
  }

  const clearTemplate = () => {
    setSelectedConfig(null)
    localStorage.removeItem(SELECTED_CONFIG_KEY)
  }

  const saveCustomTemplate = (config, name) => {
    const resolved = { ...resolveConfig(config), name, isCustom: true }
    const existing = resolveConfig(config)
    const updated = customTemplates.filter((t) => t.templateId !== existing.templateId || t.isCustom !== true)
    updated.push(resolved)
    persistCustomTemplates(updated)
    setSelectedConfig(resolved)
    localStorage.setItem(SELECTED_CONFIG_KEY, JSON.stringify(resolved))
    return resolved
  }

  const duplicateTemplate = (config, name = 'My Custom Template') => {
    const existing = resolveConfig(config)
    const copy = { ...existing, templateId: existing.templateId, name, isCustom: true }
    const updated = [...customTemplates, copy]
    persistCustomTemplates(updated)
    setSelectedConfig(copy)
    localStorage.setItem(SELECTED_CONFIG_KEY, JSON.stringify(copy))
    return copy
  }

  const deleteCustomTemplate = (configToDelete) => {
    const list = customTemplates.filter((t) => {
      return !(t.templateId === configToDelete.templateId && t.isCustom && t.name === configToDelete.name)
    })
    persistCustomTemplates(list)
  }

  const selectCustomTemplate = (config) => {
    const resolved = resolveConfig(config)
    setSelectedConfig(resolved)
    localStorage.setItem(SELECTED_CONFIG_KEY, JSON.stringify(resolved))
  }

  return (
    <TemplateContext.Provider
      value={{
        selectedConfig,
        selectedTemplateId: selectedConfig ? selectedConfig.templateId : null,
        customTemplates,
        selectTemplate,
        applyConfig,
        clearTemplate,
        saveCustomTemplate,
        duplicateTemplate,
        deleteCustomTemplate,
        selectCustomTemplate,
      }}
    >
      {children}
    </TemplateContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTemplate() {
  const context = useContext(TemplateContext)
  if (!context) {
    throw new Error('useTemplate must be used within a TemplateProvider')
  }
  return context
}
