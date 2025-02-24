'use server';
import { db } from '@/app/db';
import { eq, and, asc } from 'drizzle-orm'
import { llmSettingsTable, llmModels } from '@/app/db/schema';
import { llmModelType, llmModelTypeWithAllInfo } from '@/app/db/schema';
import { auth } from '@/auth';

type FormValues = {
  isActive?: boolean;
  apikey?: string;
  providerName?: string;
  endpoint?: string;
  order?: number;
}
export const saveToServer = async (providerId: string, values: FormValues) => {
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new Error('not allowed');
  }
  const existingRecord = await db.select().from(llmSettingsTable)
    .where(
      eq(llmSettingsTable.provider, providerId),
    )
    .limit(1);

  if (existingRecord.length > 0) {
    await db.update(llmSettingsTable)
      .set(values)
      .where(eq(llmSettingsTable.provider, providerId))
  } else {
    // 如果用户不存在，插入新记录
    await db.insert(llmSettingsTable)
      .values({
        provider: providerId,
        providerName: values.providerName || 'Untitled',
        ...values
      })
  }
};

export const fetchAllProviders = async () => {
  const settings = await db.select({
    provider: llmSettingsTable.provider,
    providerName: llmSettingsTable.providerName,
    isActive: llmSettingsTable.isActive,
    apiStyle: llmSettingsTable.apiStyle,
    logo: llmSettingsTable.logo,
  })
    .from(llmSettingsTable);
  return settings;
}

export const fetchAllLlmSettings = async () => {
  // 包含 key 等敏感信息
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new Error('not allowed');
  }
  const settings = await db.select().from(llmSettingsTable).orderBy(asc(llmSettingsTable.order));
  return settings;
}

export const fetchLlmModels = async (providerId?: string) => {
  let llmModelList;
  if (providerId) {
    llmModelList = await db
      .select()
      .from(llmModels)
      .where(eq(llmModels.providerId, providerId))
      .orderBy(asc(llmModels.order));
    ;
  } else {
    llmModelList = await db
      .select()
      .from(llmModels);
  }
  return llmModelList;
}

export const fetchAvailableProviders = async () => {
  const availableProviders = await db.select().from(llmSettingsTable).where(
    eq(llmSettingsTable.isActive, true),
  );
  return availableProviders;
}

export const fetchAvailableLlmModels = async () => {
  const result = await db
    .select()
    .from(llmSettingsTable)
    .innerJoin(llmModels, eq(llmSettingsTable.provider, llmModels.providerId))
    .orderBy(
      asc(llmSettingsTable.order),
      asc(llmModels.order),
    )
    .where(
      and(
        eq(llmSettingsTable.isActive, true),
        eq(llmModels.selected, true)
      )
    );
  const llmModelList: llmModelTypeWithAllInfo[] | null = result
    .map((i) => {
      return {
        ...i.models,
        id: i.models?.id ?? 0,
        providerName: i.llm_settings.providerName,
        providerLogo: i.llm_settings.logo || '',
      }
    })
    .filter((model) => model !== null);
  return llmModelList;
}

export const changeSelectInServer = async (modelName: string, selected: boolean) => {
  await db.update(llmModels)
    .set({
      selected: selected,
    })
    .where(eq(llmModels.name, modelName))
}

export const deleteCustomModelInServer = async (modelName: string) => {
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new Error('not allowed');
  }
  await db.delete(llmModels).where(eq(llmModels.name, modelName));
}

export const addCustomModelInServer = async (modelInfo: {
  name: string,
  displayName: string,
  maxTokens: number,
  supportVision: boolean,
  selected: boolean,
  type: 'custom',
  providerId: string,
  providerName: string,
}) => {
  const hasExist = await db
    .select()
    .from(llmModels)
    .where(
      and(
        eq(llmModels.providerId, modelInfo.providerId),
        eq(llmModels.name, modelInfo.name)
      )
    );
  if (hasExist.length > 0) {
    return {
      status: 'fail',
      message: '已存在相同名称的模型'
    }
  }
  await db.insert(llmModels).values(modelInfo);
  return {
    status: 'success',
  }

}

export const updateCustomModelInServer = async (oldModelName: string, modelInfo: {
  name: string,
  displayName: string,
  maxTokens: number,
  supportVision: boolean,
  selected: boolean,
  type: 'custom',
  providerId: string,
  providerName: string,
}) => {
  const hasExist = await db
    .select()
    .from(llmModels)
    .where(
      and(
        eq(llmModels.providerId, modelInfo.providerId),
        eq(llmModels.name, oldModelName)
      )
    );
  if (hasExist.length = 0) {
    return {
      status: 'fail',
      message: '该模型已经被删除'
    }
  }
  const result = await db
    .update(llmModels)
    .set(modelInfo)
    .where(
      and(
        eq(llmModels.providerId, modelInfo.providerId),
        eq(llmModels.name, oldModelName)
      )
    );
  return {
    status: 'success',
  }
}

export const addCustomProviderInServer = async (providerInfo: {
  provider: string,
  providerName: string,
  endpoint: string,
  api_style: string,
  apikey: string,
}) => {
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new Error('not allowed');
  }
  const hasExist = await db
    .select()
    .from(llmSettingsTable)
    .where(
      eq(llmSettingsTable.provider, providerInfo.provider),
    );
  if (hasExist.length > 0) {
    return {
      status: 'fail',
      message: '已存在相同名称的模型'
    }
  }
  await db.insert(llmSettingsTable).values({ ...providerInfo, type: 'custom', isActive: true });
  return {
    status: 'success',
  }
}

export const deleteCustomProviderInServer = async (providerId: string) => {
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new Error('not allowed');
  }
  await db.delete(llmSettingsTable).where(eq(llmSettingsTable.provider, providerId));
  return {
    status: 'success',
  }
}

export const saveModelsOrder = async (
  providerId: string,
  newOrderModels: {
    modelId: string;
    order: number
  }[]) => {
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new Error('not allowed');
  }
  const updatePromises = newOrderModels.map((item) => {
    return db
      .update(llmModels)
      .set({ order: item.order })
      .where(
        and(
          eq(llmModels.providerId, providerId),
          eq(llmModels.name, item.modelId),
        )
      )
  });

  // 执行所有更新操作
  await Promise.all(updatePromises);
}

export const saveProviderOrder = async (
  newOrderProviders: {
    providerId: string;
    order: number
  }[]) => {
  const session = await auth();
  if (!session?.user.isAdmin) {
    throw new Error('not allowed');
  }
  const updatePromises = newOrderProviders.map((item) => {
    return db
      .update(llmSettingsTable)
      .set({ order: item.order })
      .where(
        eq(llmSettingsTable.provider, item.providerId),
      )
  });

  // 执行所有更新操作
  await Promise.all(updatePromises);
}