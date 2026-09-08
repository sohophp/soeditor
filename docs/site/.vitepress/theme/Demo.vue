<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useData, useRoute } from 'vitepress';
const props = withDefaults(defineProps<{ example?: string }>(), {
    example: 'basic',
});
const { lang } = useData();
const route = useRoute();
const active = ref(false);
const failed = ref(false);
const zh = computed(() => lang.value === 'zh-CN');
const src = computed(
    () => `/demos/${props.example}.html?lang=${zh.value ? 'zh-CN' : 'en'}`,
);
watch(
    () => route.path,
    () => {
        active.value = false;
        failed.value = false;
    },
);
</script>

<template>
    <section
        class="editor-demo"
        :aria-label="zh ? 'SoEditor 交互演示' : 'Interactive SoEditor demo'"
    >
        <div class="demo-heading">
            <span>SoEditor <small>1.2.1</small></span>
            <button v-if="active" type="button" @click="active = false">
                {{ zh ? '结束体验' : 'Close demo' }}
            </button>
        </div>
        <iframe
            v-if="active"
            :src="src"
            :title="zh ? 'SoEditor 编辑示例' : 'SoEditor editing example'"
            @error="failed = true"
        />
        <div v-else class="demo-cover">
            <div aria-hidden="true" class="demo-toolbar">
                ↶ &nbsp; ↷ &nbsp; | &nbsp; <b>B</b> &nbsp; <i>I</i> &nbsp; |
                &nbsp; ≡ &nbsp; ☷ &nbsp; | &nbsp; HTML
            </div>
            <div class="demo-article">
                <span class="eyebrow">{{
                    zh ? '为网站 CMS 而生' : 'BUILT FOR YOUR CMS'
                }}</span>
                <h2>
                    {{
                        zh ? '让内容编辑回归简单' : 'Make room for your content'
                    }}
                </h2>
                <p>
                    {{
                        zh
                            ? '一篇文章、一张产品介绍，或下一次发布。用熟悉的工具，把内容写好。'
                            : 'An article, a product story, or your next announcement. Familiar tools for the work you do every day.'
                    }}
                </p>
                <div class="demo-features">
                    <span>WYSIWYG</span><span>HTML Source</span><span>CMS</span>
                </div>
                <button class="demo-start" type="button" @click="active = true">
                    {{ zh ? '开始体验' : 'Start editing' }} →
                </button>
                <p class="demo-note">
                    {{
                        zh
                            ? '点击后加载 · 内容仅保留在当前页面'
                            : 'Loads on demand · Content stays in this page'
                    }}
                </p>
            </div>
        </div>
        <p v-if="failed" role="alert">
            {{
                zh
                    ? '演示加载失败，请结束后重试。'
                    : 'Could not load the demo. Close it and try again.'
            }}
        </p>
    </section>
</template>
