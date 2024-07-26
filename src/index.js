function $primitive(type, size) {
  return {
    size,
    read: (buffer, offset = 0) => new DataView(buffer)["get" + type](offset),
    write: (buffer, value, offset = 0) => new DataView(buffer)["set" + type](offset, value),
  }
}

export const uint8 = $primitive("Uint8", 1);
export const int32 = $primitive("Int32", 4);
export const float64 = $primitive("Float64", 8);
export const bool = {
  size: uint8.size,
  read: (buffer, offset = 0) => !!uint8.read(buffer, offset),
  write: (buffer, value, offset = 0) => uint8.write(buffer, value ? 1 : 0, offset),
}

export function struct(fields) {
  let totalSize = 0;
  for (const [_, v] of Object.entries(fields)) {
    totalSize += v.size
  }

  return {
    size: totalSize,
    read: (buffer, offset = 0) => {
      const result = {};
      let currentOffset = offset;
      for (const [k, v] of Object.entries(fields)) {
        result[k] = v.read(buffer, currentOffset);
        currentOffset += v.size;
      }
      return result
    },
    write: (buffer, value, offset = 0) => {
      let currentOffset = offset;
      for (const [k, v] of Object.entries(fields)) {
        v.write(buffer, value[k], currentOffset);
        currentOffset += v.size;
      }
    }
  }
}

export function array(length, type) {
  return {
    size: length * type.size,
    read: (buffer, offset = 0) => {
      const result = [];
      for (let i = 0; i < length; i++) {
        result.push(type.read(buffer, offset + (i * type.size)));
      }
      return result;
    },
    write: (buffer, value, offset = 0) => {
      for (let i = 0; i < length; i++) {
        type.write(buffer, value[i], offset + (i * type.size));
      }
    }
  }
}

export function union(variants) {
  let size = 0;
  for (const [_, v] of Object.entries(variants)) {
    size = Math.max(size, v.size);
  }
  size += 1;

  return {
    size,
    read: (buffer, offset = 0) => {
      const discriminator = uint8.read(buffer, offset);
      const type = Object.keys(variants)[discriminator];
      return { [type]: variants[type].read(buffer, offset + 1) };
    },
    write: (buffer, value, offset = 0) => {
      const type = Object.keys(value)[0];
      const discriminator = Object.keys(variants).indexOf(type);
      uint8.write(buffer, discriminator, offset);
      variants[type].write(buffer, value[type], offset + 1);
    }
  }
}
