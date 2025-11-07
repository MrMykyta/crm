import NumericWithPresets from "../NumericWithPresets";

export default function PriorityInput(props){
  return (
    <NumericWithPresets
      min={0}
      max={100}
      step={1}
      integer
      clampOnBlur
      presets={[10,25,50,75,100]}
      showChips
      useDatalist
      size="md"
      {...props}
    />
  );
}