<script lang="ts">
    interface Props {
        isActive: boolean
    }

    let { isActive }: Props = $props()
</script>

<div
    class="
      absolute
      left-[-4px]
      h-[8px]
      w-[8px]
      rounded-full
      transition-[height,background-color]
      duration-300
      group-hover:bg-white
      {isActive ? '!h-[20px] bg-white' : 'group-hover:h-[10px]'}
    "
></div>
