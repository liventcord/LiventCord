<template>
  <h1
    :style="{
      fontSize: '12px',
      color: 'rgb(148, 155, 153)'
    }"
  >
    {{ title }}
  </h1>
</template>

<script>
export default {
  name: "CategoryTitle",
  props: {
    title: {
      type: String,
      required: true
    },
    level: {
      type: Number,
      default: 1
    }
  }
};
</script>
